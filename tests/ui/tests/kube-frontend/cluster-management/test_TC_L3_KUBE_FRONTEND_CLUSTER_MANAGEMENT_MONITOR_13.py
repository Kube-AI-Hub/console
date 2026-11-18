from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WINDOW_SECONDS = 3600
STEP = "60s"
CLUSTER_RANGE = "**/monitoring.kubesphere.io/v1alpha3/cluster**"

#: Contract §5: group → chart → (identity-carrying metrics, number of lines when all report).
RESOURCE_CHARTS = {
    "gpu": {"gpuMemory": (("cluster_gpu_memory_utilisation",), 1),
            "gpuUtilization": (("cluster_gpu_utilization",), 1),
            "gpuAllocated": (("cluster_gpu_allocated",), 1)},
    "host": {"cpu": (("cluster_cpu_utilisation",), 1),
             "memory": (("cluster_memory_utilisation",), 1),
             "load": (("load1", "load5", "load15", "cluster_load1", "cluster_load5", "cluster_load15"), 3),
             "diskUsage": (("cluster_disk_size_usage",), 1),
             "inode": (("cluster_disk_inode_utilisation",), 1),
             "pods": (("cluster_pod_running_count", "cluster_pod_succeeded_count", "cluster_pod_abnormal_count"), 3)},
    "disk": {"throughput": (("cluster_disk_read_throughput", "cluster_disk_write_throughput"), 2),
             "iops": (("cluster_disk_read_iops", "cluster_disk_write_iops"), 2)},
    "network": {"traffic": (("cluster_net_bytes_transmitted", "cluster_net_bytes_received"), 2)},
    "rdma": {"health": (("cluster_ib_health",), 1),
             "ports": (("cluster_ib_port_up", "cluster_ib_port_total"), 2),
             "throughput": (("cluster_ib_tx_bytes", "cluster_ib_rx_bytes"), 2),
             "linkSpeed": (("cluster_ib_link_speed",), 1),
             "errors": (("cluster_ib_rx_errors", "cluster_ib_retrans", "cluster_ib_discards"), 3),
             "linkDowned": (("cluster_ib_link_downed",), 1)},
}

PERCENT_CHARTS = ("gpuMemory", "gpuUtilization", "cpu", "memory", "inode", "health")
RATE_CHARTS = ("throughput", "traffic")
RATE_RE = re.compile(r"\b(?:B|KiB|MiB|GiB|TiB)/s")


def _last(points) -> float | None:
    for _at, value in reversed(points or []):
        if value == value and abs(value) != float("inf"):
            return float(value)
    return None


def _has_metric(series: dict, names) -> int:
    return sum(1 for name in names if _last(series.get(name)) is not None)


def _wait_until(predicate, timeout: float = 30.0, interval: float = 0.25) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_13(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-13 集群监控物理资源页签：5 组 18 张多序列图（坐标轴/图例/空态）。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    all_metrics = list(dict.fromkeys(
        metric
        for group in RESOURCE_CHARTS.values()
        for metrics, _lines in group.values()
        for metric in metrics
    ))
    series = ui._range(WINDOW_SECONDS, STEP, all_metrics) or {}

    # ---- one range query owns the whole tab ----
    cluster_requests: list[str] = []

    def record(route):
        cluster_requests.append(route.request.url)
        route.continue_()

    ui.page.route(CLUSTER_RANGE, record)
    try:
        ui.open("resource")
        ui.wait_ready()
        expect(ui.resource_group("gpu")).to_be_visible(timeout=30_000)
        assert _wait_until(lambda: bool(cluster_requests), timeout=15), "打开 resource 页签后没有发出 range 查询"
        time.sleep(0.8)
        assert len(cluster_requests) == 1, f"物理资源页签应只发一次 range 查询，实际 {len(cluster_requests)}"
    finally:
        ui.page.unroute(CLUSTER_RANGE)

    # ---- five groups in order, 18 charts with the contract's distribution ----
    assert ui.resource_groups() == ["gpu", "host", "disk", "network", "rdma"], ui.resource_groups()
    chart_ids = ui.resource_chart_ids()
    assert len(chart_ids) == 18 and len(set(chart_ids)) == 18, f"18 张图的唯一句柄: {chart_ids}"
    missing: list[str] = []
    for group, charts in RESOURCE_CHARTS.items():
        in_group = ui.resource_charts_in_group(group)
        assert in_group == list(charts), f"{group} 组图 {in_group} vs 契约 {list(charts)}"
        assert len(in_group) == len(charts)
        for key, (metrics, expected_lines) in charts.items():
            chart = ui.resource_chart(group, key)
            expect(chart).to_be_visible(timeout=30_000)
            empty = ui.resource_chart_empty(group, key)
            if empty.count() > 0:
                assert empty.inner_text().strip(), f"{key} 空态缺少说明文本"
                missing.append(key)
                assert chart.locator("path[data-ai-trend-line]").count() == 0, (
                    f"{key} 无数据时不应画线（零线）"
                )
                continue
            assert chart.locator("path[data-ai-trend-line]").count() > 0, f"{key} 没有画出曲线"

            # legend + drawn lines agree, and multi-series charts keep every identity.
            reported = _has_metric(series, metrics)
            expected = min(expected_lines, reported) if reported else expected_lines
            drawn = len([
                element.get_attribute("data-ai-series") or ""
                for element in chart.locator("path[data-ai-trend-line]").all()
            ])
            assert drawn >= 1, f"{key} 系列数为 0"
            assert drawn == expected, f"{key} 画了 {drawn} 条线，接口有 {reported} 个身份（期望 {expected}）"
            if expected > 1:
                legend = chart.locator(f'[data-ai-id="{ui.resource_chart_id(group, key)}:legend"]')
                assert legend.count() == 1, f"{key} 缺 :legend 图例"
                assert legend.inner_text().strip(), f"{key} 图例为空"

            text = chart.inner_text()
            if key in PERCENT_CHARTS:
                assert "%" in text, f"{key} 应以百分比显示: {text[:120]!r}"
            if key in RATE_CHARTS:
                assert RATE_RE.search(text), f"{key} 应以字节/秒显示: {text[:120]!r}"
            if key == "iops":
                assert re.search(r"\d+\.\d{2}", text), f"I OPS 应保留两位小数: {text[:120]!r}"
            if key == "linkSpeed":
                assert "Gb/s" in text, f"链路速率应以 Gb/s 显示: {text[:120]!r}"
    print(f"物理资源页签无数据（按空态断言）的图: {missing or '无'}")

    # ---- the tab is one page: charts render inside their group section ----
    for group in ui.resource_groups():
        box = ui.resource_group(group).bounding_box()
        assert box and box["width"] > 0, f"{group} 分组不可见"
    screenshot(ui.page, "cluster-monitor-resource")

    # ---- a missing metric explains itself instead of drawing a zero line ----
    ts = int(time.time())
    partial = {
        "results": [
            {
                "metric_name": "cluster_cpu_utilisation",
                "data": {"resultType": "matrix", "result": [{"metric": {}, "values": [[ts - 60, "0.25"], [ts, "0.3"]]}]},
            }
        ]
    }
    ui.page.route(CLUSTER_RANGE, lambda route: route.fulfill(status=200, json=partial))
    try:
        ui.open("resource")
        ui.wait_ready()
        expect(ui.resource_group("gpu")).to_be_visible(timeout=30_000)
        assert ui.resource_chart("host", "cpu").locator("path[data-ai-trend-line]").count() > 0, "有数据的 cpu 图应画线"
        for found_group, empty_key in (("gpu", "gpuMemory"), ("disk", "throughput"), ("network", "traffic")):
            expect(ui.resource_chart_empty(found_group, empty_key)).to_be_visible(timeout=30_000)
            assert ui.resource_chart(found_group, empty_key).locator("path[data-ai-trend-line]").count() == 0, (
                f"{empty_key} 缺数据时应给说明而不是零线"
            )
        screenshot(ui.page, "cluster-monitor-resource-partial")
    finally:
        ui.page.unroute(CLUSTER_RANGE)