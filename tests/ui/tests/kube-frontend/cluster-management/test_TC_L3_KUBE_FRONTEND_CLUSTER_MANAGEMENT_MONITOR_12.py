from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: Same window/step the page opens with (server defaults to 最近 1 小时 / 60s).
WINDOW_SECONDS = 3600
STEP = "60s"

#: key → (used metric, total metric, display unit).
USAGE_PAIRS = (
    ("gpuMemory", "cluster_gpu_memory_usage", "cluster_gpu_memory_total", "bytes"),
    ("gpu", "cluster_gpu_usage", "cluster_gpu_total", "count"),
    ("gpuAllocated", "cluster_gpu_allocated", "cluster_gpu_total", "count"),
    ("cpu", "cluster_cpu_usage", "cluster_cpu_total", "count"),
    ("memory", "cluster_memory_usage_wo_cache", "cluster_memory_total", "bytes"),
    ("disk", "cluster_disk_size_usage", "cluster_disk_size_capacity", "bytes"),
    ("pods", "cluster_pod_running_count", "cluster_pod_quota", "count"),
)

#: The 7 main-chart metrics (contract §4).
CHART_METRICS = (
    "cluster_gpu_memory_utilisation",
    "cluster_gpu_utilization",
    "cluster_gpu_allocated",
    "cluster_cpu_utilisation",
    "cluster_memory_utilisation",
    "cluster_disk_size_utilisation",
    "cluster_pod_running_count",
)

#: RDMA summary metrics (contract §4).
RDMA_METRICS = (
    "cluster_ib_port_up",
    "cluster_ib_port_total",
    "cluster_ib_tx_bytes",
    "cluster_ib_rx_bytes",
    "cluster_ib_rx_errors",
)

PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
RATIO = re.compile(r"(\d+)\s*/\s*(\d+)")
AMOUNT = re.compile(r"(-?\d+(?:\.\d+)?)\s*(TiB|GiB|MiB|KiB|B|%|卡|核|个)?")
BYTE_UNITS = {"B": 1, "KiB": 1024, "MiB": 1024 ** 2, "GiB": 1024 ** 3, "TiB": 1024 ** 4}

SERVICE_NAMESPACES = (
    "kubesphere-system",
    "kube-system",
    "istio-system",
    "kubesphere-monitoring-system",
    "kubesphere-logging-system",
    "kubesphere-devops-system",
)
CORE_COMPONENTS = ("etcd", "controller-manager", "scheduler")


def _last(points) -> float | None:
    """Last finite value of one range-query series."""
    for _at, value in reversed(points or []):
        if value == value and abs(value) != float("inf"):
            return float(value)
    return None


def _amounts(text: str) -> list[tuple[float, float]]:
    """(number, scale-to-base) pairs printed in a value string.

    Byte units scale to bytes so a displayed 9.8GiB can be compared with the API's
    10_529_000_000; counts and percentages scale by 1.
    """
    out: list[tuple[float, float]] = []
    for match in AMOUNT.finditer(text):
        unit = match.group(2) or ""
        out.append((float(match.group(1)), float(BYTE_UNITS.get(unit, 1))))
    return out


def _matches(displayed: list[tuple[float, float]], expected: float, kind: str) -> bool:
    """Whether one printed amount equals the expected value within print rounding."""
    for number, scale in displayed:
        value = number * scale
        if kind == "bytes":
            if abs(value - expected) <= max(abs(expected) * 0.02, scale * 0.06):
                return True
        else:
            # Counts are printed rounded (cores/cards/pods); allow half a unit.
            if abs(value - expected) <= 0.51:
                return True
    return False


KNOWN_VENDORS = {
    "cpu", "nvidia", "cambricon", "ascend", "hygon", "metax",
    "enflame", "kunlunxin", "iluvatar", "alibaba", "mthreads",
}


def _vendor_key(raw: str) -> str:
    """The normalisation ClusterStatusSection applies before grouping vendor counts.

    Known vendors become their canonical key; an unknown word stays verbatim, because
    the component falls back to the raw label rather than inventing a key.
    """
    lower = raw.lower()
    if lower == "cpu":
        return "CPU"
    if lower == "huawei":
        return "ascend"
    return lower if lower in KNOWN_VENDORS else raw


def _expected_usage(series: dict) -> dict[str, tuple[float, float, str]]:
    out: dict[str, tuple[float, float, str]] = {}
    for key, used_metric, total_metric, kind in USAGE_PAIRS:
        used = _last(series.get(used_metric))
        total = _last(series.get(total_metric))
        out[key] = (used, total, kind)
    return out


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_12(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12 集群监控概览：环图/构成图/组件磁贴 + 7 指标主图与明细 + RDMA 摘要。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    # ---- the same reads the tab makes, so the printed numbers can be cross-checked ----
    health_status, health = ui.component_health()
    assert health_status == 200, f"componenthealth -> {health_status}: {str(health)[:200]}"
    node_status = health.get("nodeStatus") or {}
    healthy = int(node_status.get("healthyNodes") or 0)
    total = int(node_status.get("totalNodes") or 0)
    assert total > 0, "host 应有节点；totalNodes=0 的空态由 MONITOR-09 覆盖"

    stats_status, stats = ui.node_vendor_stats()
    assert stats_status == 200, f"nodes/stats -> {stats_status}: {str(stats)[:200]}"
    vendors: dict[str, int] = {}
    for raw, count in (stats or {}).items():
        if str(raw) in ("healthy", "total"):
            continue
        key = _vendor_key(str(raw))
        vendors[key] = vendors.get(key, 0) + int(count)
    vendors = {vendor: count for vendor, count in vendors.items() if count > 0}
    vendor_total = sum(vendors.values())

    metrics = list(dict.fromkeys([m for pair in USAGE_PAIRS for m in pair[1:3]] + list(CHART_METRICS) + list(RDMA_METRICS)))
    series = ui._range(WINDOW_SECONDS, STEP, metrics) or {}
    expected = _expected_usage(series)

    ui.open()
    ui.wait_ready()

    # ---- node ring: healthy/total + percentage, both from componenthealth ----
    expect(ui.overview_node_ring()).to_be_visible(timeout=30_000)
    ratio = RATIO.search(ui.overview_node_ring_text())
    assert ratio, f"节点环图应含 healthy/total: {ui.overview_node_ring_text()!r}"
    assert (int(ratio.group(1)), int(ratio.group(2))) == (healthy, total), (
        f"环图 {ratio.group(0)} vs 接口 {healthy}/{total}"
    )
    percent_text = ui.overview_node_ring_value()
    percent = PERCENT.search(percent_text)
    assert percent, f"节点环图百分比文本: {percent_text!r}"
    assert abs(float(percent.group(1)) - healthy / total * 100) <= 1.0, percent_text

    # ---- vendor donut: one segment row per vendor, count + share from nodes/stats ----
    expect(ui.overview_vendor_donut()).to_be_visible(timeout=30_000)
    row_ids = sorted(ui.overview_vendor_ids())
    assert row_ids == sorted(vendors), f"厂商行 {row_ids} vs 接口 {sorted(vendors)}"
    for vendor, count in vendors.items():
        row = ui.overview_vendor_row(vendor)
        expect(row).to_be_visible()
        row_text = ui.overview_vendor_row_text(vendor)
        assert str(count) in row_text, f"{vendor} 行缺少数量 {count}: {row_text!r}"
        share = PERCENT.search(row_text)
        assert share, f"{vendor} 行缺少百分比: {row_text!r}"
        expected_share = count / vendor_total * 100
        assert abs(float(share.group(1)) - expected_share) <= 0.5, (
            f"{vendor} 占比 {share.group(1)}% vs 接口 {expected_share:.1f}%"
        )

    # ---- component tiles keep ClusterStatusSection's semantics ----
    expect(ui.status_card("components")).to_be_visible(timeout=30_000)
    assert ui.status_service_ids() == list(SERVICE_NAMESPACES), ui.status_service_ids()
    assert ui.status_core_ids() == list(CORE_COMPONENTS), ui.status_core_ids()
    for namespace in SERVICE_NAMESPACES:
        assert ui.status_service_status(namespace) is not None, f"{namespace} 磁贴缺 data-ai-status"
    for component in CORE_COMPONENTS:
        assert ui.status_core_status(component) is not None, f"{component} 磁贴缺 data-ai-status"

    # ---- seven usage rows in contract order, values cross-checked with the same query ----
    expect(ui.overview_usage()).to_be_visible(timeout=30_000)
    assert ui.overview_usage_keys() == list(ui.OVERVIEW_USAGE_KEYS), ui.overview_usage_keys()
    for key, used_metric, total_metric, kind in USAGE_PAIRS:
        value_text = ui.overview_usage_value(key)
        assert value_text, f"{key} 当前值为空"
        used, capacity, _ = expected[key]
        if used is None or capacity is None:
            assert "-" in value_text, f"{key} 指标缺失时应显示 «-»: {value_text!r}"
            continue
        printed = _amounts(value_text)
        assert _matches(printed, used, kind), f"{key} 用量 {value_text!r} vs 接口 {used}"
        assert _matches(printed, capacity, kind), f"{key} 总量 {value_text!r} vs 接口 {capacity}"

    # ---- the main chart draws the selected metric, with axes and a legend ----
    expect(ui.overview_usage_chart()).to_be_visible(timeout=30_000)
    if ui.overview_usage_chart_empty().count() == 0:
        assert ui.overview_usage_chart_series(), "主图有数据却没有画出曲线"
        assert ui.overview_usage_chart_legend().count() == 1, "主图缺 :usage-chart:legend"
        assert ui.overview_usage_chart_legend().inner_text().strip(), "主图图例为空"
    # Switching the selected metric changes what the big chart shows.
    if ui.overview_usage_chart_empty().count() == 0:
        before = (
            ui.overview_usage_chart().get_attribute("aria-label") or "",
            ui.overview_usage_chart_legend().inner_text().strip(),
        )
        ui.overview_usage_row("cpu").click()
        deadline = time.time() + 15
        while time.time() < deadline:
            after = (
                ui.overview_usage_chart().get_attribute("aria-label") or "",
                ui.overview_usage_chart_legend().inner_text().strip(),
            )
            if after != before:
                break
            ui.page.wait_for_timeout(200)
        else:
            pytest.fail(f"点 CPU 用量行后主图未变化: {before}")

    # ---- RDMA summary + jump to the physical-resource tab ----
    rdma_text = ui.overview_rdma().inner_text()
    assert rdma_text.strip(), "RDMA 摘要为空"
    port_up = _last(series.get("cluster_ib_port_up"))
    port_total = _last(series.get("cluster_ib_port_total"))
    if port_up is not None and port_total is not None:
        ports_text = ui.page.locator('[data-ai-id="cluster-monitor:overview:rdma:ports"]').inner_text().strip()
        assert ports_text == f"{round(port_up)}/{round(port_total)}", (
            f"RDMA 端口摘要 {ports_text!r} vs 接口 {round(port_up)}/{round(port_total)}"
        )
    expect(ui.overview_view_rdma()).to_be_visible()
    ui.overview_view_rdma().click()
    expect(ui.tabpanel("resource")).to_be_visible(timeout=30_000)
    assert ui.active_tab() == "resource", ui.active_tab()
    assert "tab=resource" in ui.page.url, ui.page.url
    assert "/monitor" in ui.page.url, "跳转不应离开监控页"

    # ---- layout: the status row is one row of equal blocks; chart dominates the list ----
    ui.select_tab("overview")
    ui.wait_ready()
    boxes = {
        "node": ui.overview_node_ring().bounding_box(),
        "vendor": ui.overview_vendor_donut().bounding_box(),
        "components": ui.status_card("components").bounding_box(),
    }
    assert all(boxes.values()), boxes
    tops = [box["y"] for box in boxes.values() if box]
    assert max(tops) - min(tops) <= 2, f"概览状态行三块 top 未对齐: {tops}"
    heights = [box["height"] for box in boxes.values() if box]
    assert max(heights) - min(heights) <= 2, f"概览状态行三块高度不一致: {heights}"
    list_box = ui.overview_usage().bounding_box()
    chart_box = ui.overview_usage_chart().bounding_box()
    assert list_box and chart_box
    assert chart_box["width"] > list_box["width"] * 1.3, (
        f"主图应明显宽于左侧明细: chart {chart_box['width']} vs list {list_box['width']}"
    )
    screenshot(ui.page, "cluster-monitor-overview")

    # ---- missing data: rows show «-», the chart explains, no zero line is drawn ----
    ui.page.route(
        "**/monitoring.kubesphere.io/v1alpha3/cluster**",
        lambda route: route.fulfill(status=200, json={"results": []}),
    )
    try:
        ui.open()
        ui.wait_ready()
        assert ui.overview_usage_keys() == list(ui.OVERVIEW_USAGE_KEYS)
        for key in ui.OVERVIEW_USAGE_KEYS:
            text = ui.overview_usage_value(key)
            assert "-" in text, f"无数据时 {key} 应显示 «-» 而不是 {text!r}"
        expect(ui.overview_usage_chart_empty()).to_be_visible(timeout=30_000)
        assert ui.overview_usage_chart().locator("path[data-ai-trend-line]").count() == 0, "无数据时不应画零线"
        screenshot(ui.page, "cluster-monitor-overview-empty")
    finally:
        ui.page.unroute("**/monitoring.kubesphere.io/v1alpha3/cluster**")