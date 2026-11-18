from __future__ import annotations

import re
import time
from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PERCENT = re.compile(r"^(\d+(?:\.\d+)?)%$")
COUNT = re.compile(r"^(\d+)$")
CLUSTER_RANGE = "**/monitoring.kubesphere.io/v1alpha3/cluster**"


def _ratio(series: dict, used_metric: str, total_metric: str) -> float | None:
    used = series.get(used_metric) or []
    total = dict(series.get(total_metric) or [])
    for at, value in reversed(used):
        capacity = total.get(at)
        if capacity and capacity > 0:
            return value / capacity * 100
    return None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_01(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-01 集群监控：四条趋势与时间窗切换。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    series = ui._range(
        3600,
        "60s",
        [
            "cluster_cpu_usage",
            "cluster_cpu_total",
            "cluster_memory_usage_wo_cache",
            "cluster_memory_total",
            "cluster_pod_running_count",
        ],
    )
    if series is None:
        pytest.skip("监控 range query 不可用，无法核对趋势")

    status, health = ui.component_health()
    assert status == 200, f"componenthealth -> {status}: {str(health)[:200]}"
    node_status = health.get("nodeStatus") or {}
    healthy = int(node_status.get("healthyNodes") or 0)
    total = int(node_status.get("totalNodes") or 0)

    ui.open("overview")
    ui.wait_ready()

    # ---- AC-01's four trends after the tab rework: nodes is the overview ring ----
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    assert ui.status_node_ratio() == f"{healthy}/{total}", (ui.status_node_ratio(), healthy, total)
    nodes_percent = PERCENT.match(ui.status_node_percent())
    assert nodes_percent, f"节点在线比例应为百分比: {ui.status_node_percent()!r}"

    ui.select_tab("resource")
    expect(ui.resource_chart("host", "cpu")).to_be_visible(timeout=30_000)
    expect(ui.resource_chart("host", "memory")).to_be_visible(timeout=30_000)
    expect(ui.resource_chart("host", "pods")).to_be_visible(timeout=30_000)

    # ---- CPU / memory are ratios of two series, not the raw metric drawn as a percent ----
    for group, key, series_key, used_metric, total_metric in (
        ("host", "cpu", "cpu", "cluster_cpu_usage", "cluster_cpu_total"),
        ("host", "memory", "memory", "cluster_memory_usage_wo_cache", "cluster_memory_total"),
    ):
        value = ui.resource_legend_value(group, key, series_key)
        match = PERCENT.match(value)
        assert match, f"{key} 当前值应为百分比: {value!r}"
        percent = float(match.group(1))
        assert 0 <= percent <= 100, f"{key} 当前值超出 0-100: {percent}"
        expected = _ratio(series, used_metric, total_metric)
        if expected is not None:
            assert abs(expected - percent) <= 5, (
                f"{key} 当前值 {percent}% 与接口算出的 {expected:.1f}% 相差过大——可能没有除以总量"
            )

    pods_value = ui.resource_legend_value("host", "pods", "running")
    assert COUNT.match(pods_value), f" pods 当前值应为整数计数: {pods_value!r}"

    screenshot(ui.page, "cluster-monitor")

    # ---- AC-02: switching the window re-reads a different interval ----
    requests: list[str] = []

    def record(route):
        requests.append(route.request.url)
        route.continue_()

    ui.page.route(CLUSTER_RANGE, record)
    try:
        date_before = list(requests)

        def window_starts() -> list[int]:
            starts: list[int] = []
            for url in requests[len(date_before):]:
                start = int((parse_qs(urlparse(url).query).get("start") or ["0"])[0])
                if start:
                    starts.append(start)
            return starts

        ui.select_range("24h")
        deadline = time.time() + 30
        starts: list[int] = []
        while time.time() < deadline:
            starts = window_starts()
            if any(abs(time.time() - value - 24 * 3600) < 600 for value in starts):
                break
            ui.page.wait_for_timeout(250)
        assert any(abs(time.time() - value - 24 * 3600) < 600 for value in starts), (
            f"切换时间窗后没有按 24 小时窗口重新取数: {starts}"
        )
    finally:
        ui.page.unroute(CLUSTER_RANGE)

    ui.wait_ready()
    expect(ui.resource_chart("host", "cpu")).to_be_visible(timeout=30_000)
    assert PERCENT.match(ui.resource_legend_value("host", "cpu", "cpu")), "24h 窗口的 CPU 当前值不是百分比"
    assert COUNT.match(ui.resource_legend_value("host", "pods", "running")), "24h 窗口的 pods 当前值不是整数"

    screenshot(ui.page, "cluster-monitor-24h")