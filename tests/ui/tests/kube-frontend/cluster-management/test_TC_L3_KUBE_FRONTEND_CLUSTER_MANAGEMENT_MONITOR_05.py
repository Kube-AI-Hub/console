from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

from pages.cluster_monitor import ClusterMonitorPage

pytestmark = pytest.mark.ui


def _series(api, cluster: str, metrics: list[str], window: int = 600, step: str = '60s') -> dict[str, list[float]]:
    end = int(time.time())
    start = end - window
    metrics_filter = '|'.join(f'{metric}$' for metric in metrics)
    status, body = api.request(
        'GET',
        f'/kapis/monitoring.kubesphere.io/v1alpha3/cluster?cluster={cluster}&metrics_filter={metrics_filter}&start={start}&end={end}&step={step}',
    )
    assert status == 200, f'metrics -> {status}: {str(body)[:200]}'
    out: dict[str, list[float]] = {}
    for result in (body or {}).get('results') or []:
        name = result.get('metric_name') or ''
        values: list[float] = []
        for series in (result.get('data') or {}).get('result') or []:
            for _at, value in series.get('values') or []:
                try:
                    values.append(float(value))
                except (TypeError, ValueError):
                    continue
        if values:
            out[name] = values
    return out


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_05(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-05 集群监控：GPU/磁盘 I/O/RDMA 面板与单位。"""

    ui = cluster_management_page
    assert ui.api is not None
    monitor = ClusterMonitorPage(ui.page, ui.base_url, ui.cluster, ui.api)
    monitor.open()
    monitor.wait_ready()

    # ---- groups: order and headings ----
    assert monitor.groups() == list(ClusterMonitorPage.GROUPS), monitor.groups()
    titles = monitor.group_titles()
    assert titles == ['GPU', '主机资源', '磁盘 I/O', '网络', 'RDMA / InfiniBand'], titles

    # ---- every physical-resource card is present: 29 in total ----
    assert monitor.charts() + monitor.empty_cards() == 29, (monitor.charts(), monitor.empty_cards())

    # ---- the new cards exist and carry a current value ----
    for card in ClusterMonitorPage.EXTRA_CARDS:
        expect(monitor.page.locator(f'[data-ai-id="cluster-monitor:{card}"]').last).to_be_visible(timeout=30_000)
        latest = monitor.latest(card)
        assert latest and latest != '-', f'{card} 没有当前值'

    # ---- units: GPU ratios become percentages, link speed becomes Gb/s ----
    for card in ('gpu-memory', 'gpu-utilization', 'rdma-health', 'rdma-ports'):
        value = monitor.latest(card)
        match = re.search(r'(\d+)%', value)
        assert match, f'{card} 应为百分比: {value!r}'
        assert 0 <= int(match.group(1)) <= 100, value
    for card in ('disk-read-throughput', 'disk-write-throughput', 'rdma-tx', 'rdma-rx'):
        assert re.search(r'/s$', monitor.latest(card)), f'{card} 应带每秒单位: {monitor.latest(card)!r}'
    for card in ('disk-read-iops', 'disk-write-iops'):
        assert re.fullmatch(r'\d+\.\d{2}', monitor.latest(card)), f'{card} 应为两位小数: {monitor.latest(card)!r}'
    assert re.fullmatch(r'[\d.]+ Gb/s', monitor.latest('rdma-link-speed')), monitor.latest('rdma-link-speed')
    for card in ('gpu-allocated', 'rdma-rx-errors', 'rdma-retrans', 'rdma-discards', 'rdma-link-downed'):
        assert re.fullmatch(r'\d+', monitor.latest(card)), f'{card} 应为整数: {monitor.latest(card)!r}'

    # ---- cross-check the percentages against the API's own series ----
    series = _series(ui.api, ui.cluster, ['cluster_gpu_memory_utilisation', 'cluster_ib_port_up', 'cluster_ib_port_total'])
    gpu = series.get('cluster_gpu_memory_utilisation')
    assert gpu, 'GPU 显存使用率没有序列'
    shown = int(re.search(r'(\d+)%', monitor.latest('gpu-memory')).group(1))
    expected = gpu[-1] * 100
    assert abs(shown - expected) <= 2, f'GPU 显存 {shown}% 与接口 {expected:.1f}% 相差过大'

    up = series.get('cluster_ib_port_up')
    total = series.get('cluster_ib_port_total')
    if up and total and total[-1] > 0:
        shown_ports = int(re.search(r'(\d+)%', monitor.latest('rdma-ports')).group(1))
        expected_ports = up[-1] / total[-1] * 100
        assert abs(shown_ports - expected_ports) <= 2, f'RDMA 端口 {shown_ports}% 与接口 {expected_ports:.1f}% 相差过大'

    # ---- node detail keeps the three node-scoped cards only ----
    node_monitor = ClusterMonitorPage(ui.page, ui.base_url, ui.cluster, ui.api)
    assert node_monitor.GROUPS == ('gpu', 'host', 'disk', 'network', 'rdma')

    screenshot(ui.page, 'cluster-monitor-physical')

