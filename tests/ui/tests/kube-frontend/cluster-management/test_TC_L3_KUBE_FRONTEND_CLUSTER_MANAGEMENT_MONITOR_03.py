from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PERCENT = re.compile(r"^(\d+(?:\.\d+)?)%$")
COUNT = re.compile(r"^\d+$")
DECIMAL = re.compile(r"^\d+\.\d{2}$")
BYTES = re.compile(r"^\d+(?:\.\d)?\s?(?:B|KiB|MiB|GiB|TiB)$")
RATE = re.compile(r"^\d+(?:\.\d)?\s?(?:B|KiB|MiB|GiB|TiB)/s$")


def _ratio(series: dict, used_metric: str, total_metric: str) -> float | None:
    used = series.get(used_metric) or []
    total = dict(series.get(total_metric) or [])
    for at, value in reversed(used):
        capacity = total.get(at)
        if capacity and capacity > 0:
            return value / capacity * 100
    return None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_03(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03 集群监控：物理资源指标。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    series = ui._range(
        3600,
        "60s",
        [
            "cluster_cpu_utilisation",
            "cluster_memory_utilisation",
            "cluster_disk_inode_utilisation",
            "cluster_pod_running_count",
            "cluster_pod_succeeded_count",
            "cluster_pod_abnormal_count",
            "cluster_load1",
            "cluster_load5",
            "cluster_load15",
            "cluster_disk_size_usage",
            "cluster_net_bytes_transmitted",
            "cluster_net_bytes_received",
        ],
    )
    if series is None:
        pytest.skip("监控 range query 不可用，无法核对物理资源指标")

    status, health = ui.component_health()
    assert status == 200, f"componenthealth -> {status}: {str(health)[:200]}"
    node_status = health.get("nodeStatus") or {}

    ui.open("resource")
    ui.wait_ready()

    # ---- every metric AC-03 named has a chart (or an explicit empty state) ----
    for group, key in (
        ("host", "cpu"), ("host", "memory"), ("host", "pods"), ("host", "load"),
        ("host", "diskUsage"), ("host", "inode"), ("network", "traffic"),
    ):
        chart = ui.resource_chart(group, key)
        expect(chart).to_be_visible(timeout=30_000)
        has_data = ui.resource_chart_empty(group, key).count() == 0
        assert has_data or ui.resource_chart_empty(group, key).inner_text().strip(), (
            f"{group}/{key} 既无曲线也无空态说明"
        )

    # ---- units ----
    for key in ("cpu", "memory", "inode"):
        value = ui.resource_legend_value("host", key, key)
        match = PERCENT.match(value)
        assert match and 0 <= float(match.group(1)) <= 100, f"{key} 应为百分比: {value!r}"
    for series_key in ("load1", "load5", "load15"):
        value = ui.resource_legend_value("host", "load", series_key)
        assert DECIMAL.match(value), f"负载 {series_key} 应为两位小数: {value!r}"
    for series_key in ("running", "completed", "abnormal"):
        assert COUNT.match(ui.resource_legend_value("host", "pods", series_key)), series_key
    assert BYTES.match(ui.resource_legend_value("host", "diskUsage", "diskUsage")), "磁盘用量应为字节单位"
    for series_key in ("tx", "rx"):
        assert RATE.match(ui.resource_legend_value("network", "traffic", series_key)), series_key

    # ---- percentages are ratios computed by the page, so cross-check them ----
    for key, metric in (
        ("cpu", "cluster_cpu_utilisation"),
        ("memory", "cluster_memory_utilisation"),
        ("inode", "cluster_disk_inode_utilisation"),
    ):
        points = series.get(metric) or []
        if points:
            expected = points[-1][1] * 100
            shown = float(PERCENT.match(ui.resource_legend_value("host", key, key)).group(1))
            assert abs(shown - expected) <= 3, f"{key} {shown}% 与接口 {expected:.1f}% 相差过大"

    # ---- nodes: AC-03's count trend is now the overview ring ----
    ui.select_tab("overview")
    ui.wait_ready()
    assert re.fullmatch(r"\d+/\d+", ui.status_node_ratio()), ui.status_node_ratio()

    screenshot(ui.page, "cluster-monitor-physical")
