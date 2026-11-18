from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PERCENT = re.compile(r"^(\d+(?:\.\d+)?)%$")
COUNT = re.compile(r"^\d+$")
DECIMAL = re.compile(r"^\d+\.\d{2}$")
RATE = re.compile(r"^\d+(?:\.\d)?\s?(?:B|KiB|MiB|GiB|TiB)/s$")

GROUP_TITLES = ("GPU", "主机资源", "磁盘 I/O", "网络", "RDMA / InfiniBand")


def _last(series: dict, metric: str) -> float | None:
    points = series.get(metric) or []
    for _at, value in reversed(points):
        if value == value and abs(value) != float("inf"):
            return value
    return None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_05(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05 集群监控：GPU / 磁盘 I/O / RDMA 面板与单位。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    series = ui._range(
        3600,
        "60s",
        [
            "cluster_gpu_memory_utilisation",
            "cluster_gpu_utilization",
            "cluster_gpu_allocated",
            "cluster_ib_health",
            "cluster_ib_port_up",
            "cluster_ib_port_total",
            "cluster_ib_tx_bytes",
            "cluster_ib_rx_bytes",
            "cluster_ib_link_speed",
            "cluster_ib_rx_errors",
            "cluster_ib_retrans",
            "cluster_ib_discards",
            "cluster_ib_link_downed",
            "cluster_disk_read_throughput",
            "cluster_disk_write_throughput",
            "cluster_disk_read_iops",
            "cluster_disk_write_iops",
            "cluster_net_bytes_transmitted",
            "cluster_net_bytes_received",
        ],
    )
    if series is None:
        pytest.skip("监控 range query 不可用，无法核对 GPU/磁盘/RDMA 指标")

    ui.open("resource")
    ui.wait_ready()

    # ---- groups: order and headings ----
    assert ui.resource_groups() == ["gpu", "host", "disk", "network", "rdma"], ui.resource_groups()
    titles = tuple(
        ui.resource_group(group).locator(":scope > h2").first.inner_text().strip()
        for group in ui.resource_groups()
    )
    assert titles == GROUP_TITLES, titles

    # ---- every physical-resource chart is present: 18 in total ----
    assert len(ui.resource_chart_ids()) == 18, ui.resource_chart_ids()

    def unit_check(group: str, key: str, series_key: str, pattern: re.Pattern, label: str) -> None:
        if ui.resource_chart_empty(group, key).count() > 0:
            assert ui.resource_chart_empty(group, key).inner_text().strip(), f"{group}/{key} 空态缺说明"
            return
        value = ui.resource_legend_value(group, key, series_key)
        assert pattern.match(value), f"{label} 单位不对: {value!r}"

    # ---- GPU ratios become percentages, counts stay integers ----
    unit_check("gpu", "gpuMemory", "gpuMemory", PERCENT, "GPU 显存使用率")
    unit_check("gpu", "gpuUtilization", "gpuUtilization", PERCENT, "GPU 使用率")
    unit_check("gpu", "gpuAllocated", "gpuAllocated", COUNT, "已分配 GPU 卡数")

    # ---- disk / network: bytes per second, IOPS two decimals ----
    for series_key in ("read", "write"):
        unit_check("disk", "throughput", series_key, RATE, f"磁盘吞吐 {series_key}")
        unit_check("disk", "iops", series_key, DECIMAL, f"磁盘 IOPS {series_key}")
    for series_key in ("tx", "rx"):
        unit_check("network", "traffic", series_key, RATE, f"网络流量 {series_key}")

    # ---- RDMA: percent health, counts, B/s, Gb/s ----
    unit_check("rdma", "health", "health", PERCENT, "RDMA 健康度")
    for series_key in ("portUp", "portTotal"):
        unit_check("rdma", "ports", series_key, COUNT, f"RDMA 端口 {series_key}")
    for series_key in ("tx", "rx"):
        unit_check("rdma", "throughput", series_key, RATE, f"RDMA 吞吐 {series_key}")
    for series_key in ("rxErrors", "retrans", "discards"):
        unit_check("rdma", "errors", series_key, COUNT, f"RDMA 错误 {series_key}")
    unit_check("rdma", "linkDowned", "linkDowned", COUNT, "RDMA 链路中断数")
    if ui.resource_chart_empty("rdma", "linkSpeed").count() == 0:
        value = ui.resource_legend_value("rdma", "linkSpeed", "linkSpeed")
        assert re.fullmatch(r"\d+\.\d Gb/s", value), f"链路速率应以 Gb/s 显示并保留一位小数: {value!r}"

    # ---- cross-check the percentages against the API's own series ----
    gpu = _last(series, "cluster_gpu_memory_utilisation")
    if gpu is not None and ui.resource_chart_empty("gpu", "gpuMemory").count() == 0:
        shown = float(PERCENT.match(ui.resource_legend_value("gpu", "gpuMemory", "gpuMemory")).group(1))
        expected = gpu * 100
        assert abs(shown - expected) <= 2, f"GPU 显存 {shown}% 与接口 {expected:.1f}% 相差过大"

    up, total = _last(series, "cluster_ib_port_up"), _last(series, "cluster_ib_port_total")
    if up is not None and total is not None and ui.resource_chart_empty("rdma", "ports").count() == 0:
        assert COUNT.match(ui.resource_legend_value("rdma", "ports", "portUp"))
        assert COUNT.match(ui.resource_legend_value("rdma", "ports", "portTotal"))
        assert int(ui.resource_legend_value("rdma", "ports", "portTotal")) == round(total)

    screenshot(ui.page, "cluster-monitor-physical")