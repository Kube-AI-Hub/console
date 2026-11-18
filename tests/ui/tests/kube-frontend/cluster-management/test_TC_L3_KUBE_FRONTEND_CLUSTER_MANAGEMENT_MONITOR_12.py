from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

from helpers.api import ApiClient

pytestmark = pytest.mark.ui

#: Same window/step the page opens with (server defaults to 最近 1 小时 / 60s).
WINDOW_SECONDS = 3600
STEP = "60s"

CLUSTER_RANGE = "**/monitoring.kubesphere.io/v1alpha3/cluster**"
COMPONENT_ENDPOINTS = "**/monitoring.kubesphere.io/v1alpha3/components/**"

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

PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
RATIO = re.compile(r"(\d+)\s*/\s*(\d+)")
AMOUNT = re.compile(r"(-?\d+(?:\.\d+)?)\s*(TiB|GiB|MiB|KiB|B|%|卡|核|个)?")
BYTE_UNITS = {"B": 1, "KiB": 1024, "MiB": 1024 ** 2, "GiB": 1024 ** 3, "TiB": 1024 ** 4}
INTEGER = re.compile(r"^\d+$")
MS = re.compile(r"^\d+(?:\.\d+)? ms$")
PER_SECOND = re.compile(r"^\d+\.\d{2} (?:次/秒|req/s)$")

SERVICE_NAMESPACES = (
    "kubesphere-system",
    "kube-system",
    "istio-system",
    "kubesphere-monitoring-system",
    "kubesphere-logging-system",
    "kubesphere-devops-system",
)
CORE_COMPONENTS = ("etcd", "controller-manager", "scheduler")

APISERVER_METRICS = (
    "apiserver_request_rate",
    "apiserver_request_by_verb_rate",
    "apiserver_request_latencies",
    "apiserver_request_by_verb_latencies",
)
SCHEDULER_METRICS = (
    "scheduler_schedule_attempts",
    "scheduler_schedule_attempt_rate",
    "scheduler_e2e_scheduling_latency",
    "scheduler_e2e_scheduling_latency_quantile",
)


def _last(points) -> float | None:
    """Last finite value of one range-query series."""
    for _at, value in reversed(points or []):
        if value == value and abs(value) != float("inf"):
            return float(value)
    return None


def _amounts(text: str) -> list[tuple[float, float]]:
    """(number, scale-to-base) pairs printed in a value string."""
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
            if abs(value - expected) <= 0.51:
                return True
    return False


KNOWN_VENDORS = {
    "cpu", "nvidia", "cambricon", "ascend", "hygon", "metax",
    "enflame", "kunlunxin", "iluvatar", "alibaba", "mthreads",
}


def _vendor_key(raw: str) -> str:
    lower = raw.lower()
    if lower == "cpu":
        return "CPU"
    if lower == "huawei":
        return "ascend"
    return lower if lower in KNOWN_VENDORS else raw


def _expected_usage(series: dict) -> dict[str, tuple[float | None, float | None, str]]:
    out: dict[str, tuple[float | None, float | None, str]] = {}
    for key, used_metric, total_metric, kind in USAGE_PAIRS:
        out[key] = (_last(series.get(used_metric)), _last(series.get(total_metric)), kind)
    return out


def _finite_identities(series: dict, metric: str, label: str) -> set[str]:
    out: set[str] = set()
    for labels, values in series.get(metric) or []:
        value = (labels or {}).get(label)
        if value and any(v == v and abs(v) != float("inf") for v in values):
            out.add(str(value))
    return out


def _working_api(ui, session_token: str):
    """An API client whose base answers `/kapis`.

    The local static station serves the app under `/kube-frontend`, and the BFF
    prefixes that path to `/kube-frontend/kapis`; the deployed console answers
    `/kapis` at the origin root. Probe rather than guess, so the same case runs
    against both.
    """
    api = ui.api
    assert api is not None
    status, _ = api.request("GET", "/kapis/version")
    if status == 200:
        return api
    candidate = ApiClient(f"{str(api.base).rstrip('/')}/kube-frontend", session_token)
    status, _ = candidate.request("GET", "/kapis/version")
    assert status == 200, f"API 不可达：{api.base}/kapis 与 {candidate.base}/kapis 都不是 200"
    return candidate


def _expected_abnormal(ports: list[dict]) -> list[dict]:
    by_node: dict[str, dict] = {}
    for port in ports:
        entry = by_node.setdefault(port["node"], {"node": port["node"], "down": 0, "total": 0})
        entry["total"] += 1
        if not port["healthy"]:
            entry["down"] += 1
    return sorted(
        (entry for entry in by_node.values() if entry["down"] > 0),
        key=lambda entry: entry["down"],
        reverse=True,
    )


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_12(cluster_monitor_page, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-12 集群监控概览：环图/构成图/组件磁贴 + 7 指标主图与明细 + RDMA 状态块 + 服务组件监控块。"""

    ui = cluster_monitor_page
    assert ui.api is not None
    ui.api = _working_api(ui, session_token)

    # ---- the same reads the tab makes, so the printed numbers can be cross-checked ----
    health_status, health = ui.component_health()
    assert health_status == 200, f"componenthealth -> {health_status}: {str(health)[:200]}"
    node_status = health.get("nodeStatus") or {}
    healthy = int(node_status.get("healthyNodes") or 0)
    total = int(node_status.get("totalNodes") or 0)
    assert total > 0, f"{ui.cluster} 应有节点；totalNodes=0 的空态由 MONITOR-09 覆盖"

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

    rdma_metrics = [metric for _key, metrics in ui.RDMA_TAB_SPECS for metric in metrics]
    metrics = list(dict.fromkeys([m for pair in USAGE_PAIRS for m in pair[1:3]] + list(CHART_METRICS) + rdma_metrics))
    series = ui._range(WINDOW_SECONDS, STEP, metrics) or {}
    expected = _expected_usage(series)

    apiserver = ui.component_series("apiserver", list(APISERVER_METRICS))
    scheduler = ui.component_series("scheduler", list(SCHEDULER_METRICS))

    ui.open()
    ui.wait_ready()

    # ================= 现有概览断言（状态行 / 用量 / 主图） =================
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

    expect(ui.overview_vendor_donut()).to_be_visible(timeout=30_000)
    assert sorted(ui.overview_vendor_ids()) == sorted(vendors), (ui.overview_vendor_ids(), sorted(vendors))
    for vendor, count in vendors.items():
        row_text = ui.overview_vendor_row_text(vendor)
        assert str(count) in row_text, f"{vendor} 行缺少数量 {count}: {row_text!r}"
        share = PERCENT.search(row_text)
        assert share, f"{vendor} 行缺少百分比: {row_text!r}"
        expected_share = count / vendor_total * 100
        assert abs(float(share.group(1)) - expected_share) <= 0.5, row_text

    expect(ui.status_card("components")).to_be_visible(timeout=30_000)
    assert ui.status_service_ids() == list(SERVICE_NAMESPACES), ui.status_service_ids()
    assert ui.status_core_ids() == list(CORE_COMPONENTS), ui.status_core_ids()

    expect(ui.overview_usage()).to_be_visible(timeout=30_000)
    assert ui.overview_usage_keys() == list(ui.OVERVIEW_USAGE_KEYS), ui.overview_usage_keys()
    for key, used_metric, total_metric, kind in USAGE_PAIRS:
        value_text = ui.overview_usage_value(key)
        assert value_text, f"{key} 当前值为空"
        used, capacity, _kind = expected[key]
        if used is None or capacity is None:
            assert "-" in value_text, f"{key} 指标缺失时应显示 «-»: {value_text!r}"
            continue
        printed = _amounts(value_text)
        assert _matches(printed, used, kind), f"{key} 用量 {value_text!r} vs 接口 {used}"
        assert _matches(printed, capacity, kind), f"{key} 总量 {value_text!r} vs 接口 {capacity}"

    expect(ui.overview_usage_chart()).to_be_visible(timeout=30_000)
    if ui.overview_usage_chart_empty().count() == 0:
        assert ui.overview_usage_chart_series(), "主图有数据却没有画出曲线"
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

    # ================= RDMA 状态块（4 页签 + 图 + 端口清单） =================
    expect(ui.rdma_block()).to_be_visible(timeout=30_000)
    assert ui.rdma_tab_ids() == [key for key, _ in ui.RDMA_TAB_SPECS], ui.rdma_tab_ids()
    for key, _metrics in ui.RDMA_TAB_SPECS:
        assert ui.rdma_tab_value(key).strip(), f"RDMA 页签 {key} 当前值为空"
        assert ui.rdma_tab_state(key) in ("ready", "empty"), ui.rdma_tab_state(key)

    health_last = _last(series.get("cluster_ib_health"))
    if health_last is not None and ui.rdma_tab_state("health") == "ready":
        shown = PERCENT.search(ui.rdma_tab_value("health"))
        assert shown, ui.rdma_tab_value("health")
        assert abs(float(shown.group(1)) - health_last * 100) <= 1.5, (
            f"RDMA 健康度 {shown.group(0)} vs 接口 {health_last * 100:.1f}%"
        )
    port_up, port_total = _last(series.get("cluster_ib_port_up")), _last(series.get("cluster_ib_port_total"))
    if port_up is not None and port_total is not None:
        ports_shown = RATIO.search(ui.rdma_tab_value("ports"))
        assert ports_shown, ui.rdma_tab_value("ports")
        assert (int(ports_shown.group(1)), int(ports_shown.group(2))) == (round(port_up), round(port_total)), (
            f"RDMA 端口 {ports_shown.group(0)} vs 接口 {round(port_up)}/{round(port_total)}"
        )
    assert re.search(r"(B/s|KiB/s|MiB/s|GiB/s|TiB/s)", ui.rdma_tab_value("throughput")), ui.rdma_tab_value("throughput")
    assert re.fullmatch(r"\d+ / \d+", ui.rdma_tab_value("ports")), ui.rdma_tab_value("ports")
    assert re.fullmatch(r"\d+ / \d+", ui.rdma_tab_value("errors")), ui.rdma_tab_value("errors")
    assert re.fullmatch(r"\d+(?:\.\d)?%", ui.rdma_tab_value("health")), ui.rdma_tab_value("health")
    assert " / " in ui.rdma_tab_value("throughput"), ui.rdma_tab_value("throughput")

    # Switching a tab changes the chart title and the legend identities.
    rdma_titles: list[str] = []
    for key, tab_metrics in ui.RDMA_TAB_SPECS:
        ui.select_rdma_tab(key)
        expect(ui.rdma_chart()).to_be_visible(timeout=30_000)
        title = ui.rdma_chart().get_attribute("aria-label") or ""
        assert title, f"RDMA {key} 图缺少标题"
        rdma_titles.append(title)
        if ui.rdma_chart_empty().count() > 0:
            assert ui.rdma_chart_empty().inner_text().strip(), f"RDMA {key} 空态缺说明"
            assert ui.rdma_chart_series_ids() == [], f"RDMA {key} 无数据不应画零线"
            continue
        expected_legend = [metric for metric in tab_metrics if _last(series.get(metric)) is not None]
        assert ui.rdma_legend_ids() == expected_legend, (
            f"RDMA {key} 图例 {ui.rdma_legend_ids()} vs 接口有数据的指标 {expected_legend}"
        )
        for metric in expected_legend:
            assert ui.rdma_legend_text(metric).strip(), f"RDMA {key} 图例 {metric} 为空"
        assert len(set(ui.rdma_chart_series_ids())) == len(ui.rdma_chart_series_ids()), "RDMA 图有重复身份"
    assert len(set(rdma_titles)) == len(rdma_titles), f"RDMA 页签标题没有变化: {rdma_titles}"

    # Port inventory: the node list must match the ports API, not a hard-coded sentence.
    try:
        ports = ui.rdma_ports()
    except AssertionError:
        expect(ui.rdma_inventory_unavailable()).to_be_visible(timeout=30_000)
    else:
        abnormal = _expected_abnormal(ports)
        if not abnormal:
            expect(ui.rdma_no_abnormal()).to_be_visible(timeout=30_000)
            assert "所有 RDMA 端口均正常" in ui.rdma_no_abnormal().inner_text()
        else:
            expect(ui.rdma_abnormal()).to_be_visible(timeout=30_000)
            shown_nodes = ui.rdma_abnormal_nodes()
            assert sorted(shown_nodes) == sorted(entry["node"] for entry in abnormal), (
                f"异常节点 {sorted(shown_nodes)} vs 端口清单 {sorted(entry['node'] for entry in abnormal)}"
            )
            for entry in abnormal:
                text = shown_nodes[entry["node"]]
                assert f"{entry['down']}/{entry['total']}" in text, (
                    f"{entry['node']} 应显示 {entry['down']}/{entry['total']}: {text!r}"
                )

    # ================= 服务组件监控块（4 页签 + 图） =================
    expect(ui.components_block()).to_be_visible(timeout=30_000)
    assert ui.components_tab_ids() == [key for key, _component, _metrics in ui.COMPONENTS_TAB_SPECS], ui.components_tab_ids()
    for key, _component, _metrics in ui.COMPONENTS_TAB_SPECS:
        assert ui.components_tab_value(key).strip(), f"组件页签 {key} 当前值为空"
        assert ui.components_tab_state(key) in ("ready", "empty"), ui.components_tab_state(key)
    assert MS.match(ui.components_tab_value("latency")), ui.components_tab_value("latency")
    assert PER_SECOND.match(ui.components_tab_value("requestRate")), ui.components_tab_value("requestRate")
    assert INTEGER.match(ui.components_tab_value("attempts")), ui.components_tab_value("attempts")
    assert PER_SECOND.match(ui.components_tab_value("attemptRate")), ui.components_tab_value("attemptRate")

    verb_latencies = _finite_identities(apiserver, "apiserver_request_by_verb_latencies", "verb")
    attempt_results = _finite_identities(scheduler, "scheduler_schedule_attempts", "result")
    attempt_rate_results = _finite_identities(scheduler, "scheduler_schedule_attempt_rate", "result")
    expected_legend_by_tab: dict[str, set[str]] = {
        "latency": {f"verb:{verb}" for verb in verb_latencies},
        "requestRate": {"apiserver_request_rate"},
        "attempts": {f"result:{result}" for result in attempt_results},
        "attemptRate": {f"result:{result}" for result in attempt_rate_results},
    }
    average_latency_present = any(
        any(value == value and abs(value) != float("inf") for value in values)
        for _labels, values in apiserver.get("apiserver_request_latencies") or []
    )
    if average_latency_present:
        expected_legend_by_tab["latency"].add("apiserver_request_latencies")

    component_titles: list[str] = []
    for key, _component, _metrics in ui.COMPONENTS_TAB_SPECS:
        ui.select_components_tab(key)
        expect(ui.components_chart()).to_be_visible(timeout=30_000)
        title = ui.components_chart().get_attribute("aria-label") or ""
        assert title, f"组件页签 {key} 图缺少标题"
        component_titles.append(title)
        if ui.components_chart_empty().count() > 0:
            assert ui.components_chart_empty().inner_text().strip(), f"组件 {key} 空态缺说明"
            assert ui.components_chart_series_ids() == [], f"组件 {key} 无数据不应画零线"
            continue
        expected_lines = expected_legend_by_tab[key]
        if expected_lines:
            assert set(ui.components_legend_ids()) == expected_lines, (
                f"组件 {key} 图例 {sorted(ui.components_legend_ids())} vs 接口身份 {sorted(expected_lines)}"
            )
    assert len(set(component_titles)) == len(component_titles), f"组件页签标题没有变化: {component_titles}"

    # ---- the four overview sections stack in order, and the old jump button is gone ----
    order = {
        "status": ui.status_section.bounding_box(),
        "usage": ui.overview_usage().bounding_box(),
        "rdma": ui.rdma_block().bounding_box(),
        "components": ui.components_block().bounding_box(),
    }
    assert all(order.values()), order
    assert order["status"]["y"] < order["usage"]["y"] < order["rdma"]["y"] < order["components"]["y"], (
        f"概览四分区顺序不对: {[(name, box['y']) for name, box in order.items()]}"
    )
    assert ui.page.locator('[data-ai-id="cluster-monitor:overview:view-rdma"]').count() == 0, (
        "RDMA 已改为块内页签，不应再有「查看 RDMA 趋势」按钮"
    )

    # ---- layout: the status row is one row of equal blocks; chart dominates the list ----
    boxes = {
        "node": ui.overview_node_ring().bounding_box(),
        "vendor": ui.overview_vendor_donut().bounding_box(),
        "components": ui.status_card("components").bounding_box(),
    }
    assert all(boxes.values()), boxes
    tops = [box["y"] for box in boxes.values() if box]
    assert max(tops) - min(tops) <= 2, f"概览状态行三块 top 未对齐: {tops}"
    list_box = ui.overview_usage().bounding_box()
    chart_box = ui.overview_usage_chart().bounding_box()
    assert list_box and chart_box
    assert chart_box["width"] > list_box["width"] * 1.3, (
        f"主图应明显宽于左侧明细: chart {chart_box['width']} vs list {list_box['width']}"
    )
    screenshot(ui.page, "cluster-monitor-overview")

    # ================= 空态：两块都给说明、不画零线 =================
    ui.page.route(CLUSTER_RANGE, lambda route: route.fulfill(status=200, json={"results": []}))
    try:
        ui.open()
        ui.wait_ready()
        expect(ui.rdma_block()).to_be_visible(timeout=30_000)
        for key, _metrics in ui.RDMA_TAB_SPECS:
            expect(ui.rdma_chart_empty()).to_be_visible(timeout=30_000)
            assert ui.rdma_chart_empty().inner_text().strip(), f"RDMA {key} 空态缺说明"
            assert ui.rdma_chart_series_ids() == [], f"RDMA {key} 无数据时不应画零线"
            assert ui.rdma_tab_value(key).strip() in ("-", "—"), f"RDMA {key} 无数据时当前值应为 «-»"
            assert ui.rdma_tab_state(key) == "empty", ui.rdma_tab_state(key)
        # The components block owns its own queries: the overview range failing must not
        # blank it (and a missing RDMA series must not be drawn as a zero line).
        expect(ui.components_block()).to_be_visible(timeout=30_000)
        deadline = time.time() + 30
        while time.time() < deadline and ui.components_tab_value("latency").strip() in ("", "-"):
            ui.page.wait_for_timeout(250)
        assert ui.components_tab_value("latency").strip() not in ("", "-"), (
            f"概览 range 为空不应影响服务组件监控块: {ui.components_tab_value('latency')!r}"
        )
        screenshot(ui.page, "cluster-monitor-overview-empty")
    finally:
        ui.page.unroute(CLUSTER_RANGE)

    # ================= 服务组件无数据 / 失败 / 无权限 =================
    ui.page.route(COMPONENT_ENDPOINTS, lambda route: route.fulfill(status=200, json={"results": []}))
    try:
        ui.open()
        ui.wait_ready()
        expect(ui.components_block()).to_be_visible(timeout=30_000)
        for key, _component, _metrics in ui.COMPONENTS_TAB_SPECS:
            ui.select_components_tab(key)
            expect(ui.components_chart_empty()).to_be_visible(timeout=30_000)
            empty_text = ui.components_chart_empty().inner_text()
            assert empty_text.strip(), f"组件 {key} 空态缺说明"
            assert "未上报" in empty_text or "does not report" in empty_text, empty_text
            assert ui.components_chart_series_ids() == [], f"组件 {key} 无数据时不应画零线"
            assert ui.components_tab_value(key).strip() in ("-", "—"), f"组件 {key} 无数据时当前值应为 «-»"
    finally:
        ui.page.unroute(COMPONENT_ENDPOINTS)

    requests: list[str] = []

    def unavailable(route):
        requests.append(route.request.url)
        route.fulfill(status=500, json={"message": "components unavailable"})

    ui.page.route(COMPONENT_ENDPOINTS, unavailable)
    try:
        ui.open()
        ui.wait_ready()
        expect(ui.components_chart()).to_have_attribute("data-ai-state", "error", timeout=30_000)
        retry = ui.components_retry()
        expect(retry).to_be_visible(timeout=30_000)
        before = len(requests)
        retry.click()
        deadline = time.time() + 30
        while time.time() < deadline and len(requests) <= before:
            ui.page.wait_for_timeout(200)
        assert len(requests) > before, "点重试后没有重新请求组件指标"
    finally:
        ui.page.unroute(COMPONENT_ENDPOINTS)

    ui.page.route(COMPONENT_ENDPOINTS, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    try:
        ui.open()
        ui.wait_ready()
        expect(ui.components_chart()).to_have_attribute("data-ai-state", "error", timeout=30_000)
        assert "无权限" in ui.components_chart().inner_text() or "权限" in ui.components_chart().inner_text(), (
            ui.components_chart().inner_text()[:200]
        )
        assert ui.components_retry().count() == 0, "403 时不应提供重试"
    finally:
        ui.page.unroute(COMPONENT_ENDPOINTS)
        ui.open()
        ui.wait_ready()