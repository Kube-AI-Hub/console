from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

from pages.cluster_monitor import ClusterMonitorPage

pytestmark = pytest.mark.ui

APISERVER_METRICS = [
    'apiserver_request_rate',
    'apiserver_request_by_verb_rate',
    'apiserver_request_latencies',
    'apiserver_request_by_verb_latencies',
]
APISERVER_COMPONENT = re.compile(r'.*/kapis/monitoring\.kubesphere\.io/v1alpha3/components/apiserver(?:\?.*)?$')
SCHEDULER_METRICS = [
    'scheduler_schedule_attempts',
    'scheduler_schedule_attempt_rate',
    'scheduler_e2e_scheduling_latency',
    'scheduler_e2e_scheduling_latency_quantile',
]


def _number(text: str) -> float:
    match = re.search(r'-?\d+(?:\.\d+)?', text.replace(',', ''))
    assert match, f'没有数字: {text!r}'
    return float(match.group(0))


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_06(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06 集群监控：系统组件 APIServer/Scheduler 多序列、身份与单位。"""

    ui = cluster_management_page
    assert ui.api is not None
    monitor = ClusterMonitorPage(ui.page, ui.base_url, ui.cluster, ui.api)
    monitor.open()
    monitor.wait_ready()

    # ---- 分区在物理资源分组之后，三个子组顺序固定 ----
    expect(ui.page.locator('[data-ai-id="cluster-monitor:components"]')).to_be_visible(timeout=30_000)
    assert monitor.component_groups() == list(ClusterMonitorPage.COMPONENTS), monitor.component_groups()
    monitor.wait_component_state('apiserver', 'ready')
    monitor.wait_component_state('scheduler', 'ready')
    # etcd 是「未上报」分支，本用例只确认它在位；其断言见 TC-...-07。
    monitor.wait_component_state('etcd', 'empty')

    # ---- 卡片集合与渲染顺序 ----
    assert monitor.component_card_keys('apiserver') == list(ClusterMonitorPage.COMPONENT_CARDS['apiserver'])
    assert monitor.component_card_keys('scheduler') == list(ClusterMonitorPage.COMPONENT_CARDS['scheduler'])

    apiserver = monitor.component_series('apiserver', APISERVER_METRICS)

    # ---- 多序列：按 verb 身份一条线；只有有有限值的身份才出现，绝不按位置合并 ----
    finite_verb_latencies = {
        labels.get('verb'): values
        for labels, values in apiserver.get('apiserver_request_by_verb_latencies') or []
        if labels.get('verb') and values
    }
    assert finite_verb_latencies, '接口没有可用的 verb 延迟序列'
    latency_legend = monitor.component_card_series('apiserver', 'requestLatency')
    rendered_verbs = {key[len('verb:'):] for key in latency_legend if key.startswith('verb:')}
    assert rendered_verbs, f'按 verb 的延迟一条线都没有: {latency_legend}'
    # 每条线都必须有对应的有限值序列：全 NaN 的身份不会画出 0 线（NaN 分支另有 mock 断言）。
    assert rendered_verbs <= set(finite_verb_latencies), rendered_verbs - set(finite_verb_latencies)
    assert 'apiserver_request_latencies' in latency_legend, '总平均没有单独成线'
    assert len(latency_legend) == len(rendered_verbs) + 1, (latency_legend, finite_verb_latencies)
    drawn = monitor.component_card_chart_series('apiserver', 'requestLatency')
    assert len(drawn) == len(rendered_verbs) + 1, drawn
    assert len(set(drawn)) == len(drawn), f'身份被合并或重复: {drawn}'

    # ---- 单位：接口秒值 ×1000 显示为 ms，允许采样时刻差异但不允许数量级错误 ----
    get_values = finite_verb_latencies['GET']
    shown_get = _number(latency_legend['verb:GET'])
    expected_get = get_values[-1] * 1000
    assert latency_legend['verb:GET'].strip().endswith('ms'), latency_legend['verb:GET']
    assert shown_get > 0 and abs(shown_get - expected_get) / expected_get < 5, (shown_get, expected_get)

    # ---- 请求速率：按 verb 的线身份齐全，且各线之和与总速率一致（同一请求时刻） ----
    by_verb_rate = {
        labels.get('verb'): values
        for labels, values in apiserver.get('apiserver_request_by_verb_rate') or []
        if labels.get('verb') and values
    }
    rate_legend = monitor.component_card_series('apiserver', 'requestRateByVerb')
    assert set(rate_legend) == {f'verb:{verb}' for verb in by_verb_rate}, (sorted(rate_legend), sorted(by_verb_rate))
    total_rate = _number(monitor.component_card_latest('apiserver', 'requestRate'))
    by_verb_sum = sum(_number(value) for value in rate_legend.values())
    assert total_rate > 0, total_rate
    assert abs(by_verb_sum - total_rate) / total_rate < 0.2, (by_verb_sum, total_rate)

    # ---- Scheduler：result 三条身份，尝试次数是累积计数、速率是每秒值 ----
    scheduler = monitor.component_series('scheduler', SCHEDULER_METRICS)
    attempts = {
        labels.get('result'): values
        for labels, values in scheduler.get('scheduler_schedule_attempts') or []
        if labels.get('result') and values
    }
    assert set(attempts) >= {'scheduled', 'error', 'unschedulable'}, attempts
    attempt_legend = monitor.component_card_series('scheduler', 'scheduleAttempts')
    assert set(attempt_legend) == {f'result:{result}' for result in ('scheduled', 'error', 'unschedulable')}, attempt_legend
    for result, values in attempts.items():
        shown = _number(attempt_legend[f'result:{result}'])
        assert values[0] - 20 <= shown <= values[-1] + 20, (result, shown, values[0], values[-1])
        assert re.fullmatch(r'\d+', attempt_legend[f'result:{result}'].strip()), attempt_legend[f'result:{result}']

    rate_legend_scheduler = monitor.component_card_series('scheduler', 'scheduleAttemptRate')
    assert set(rate_legend_scheduler) == {f'result:{result}' for result in ('scheduled', 'error', 'unschedulable')}, rate_legend_scheduler
    # 有序列且值为 0 是「真实 0」，必须显示 0.00 次/秒，而不是空态。
    assert not monitor.component_card_is_empty('scheduler', 'scheduleAttemptRate')
    for value in rate_legend_scheduler.values():
        assert re.fullmatch(r'\d+\.\d{2} (次/秒|req/s)', value), value

    # ---- 调度延迟在本部署没有序列：空态说明，不是 0 线 ----
    assert not (scheduler.get('scheduler_e2e_scheduling_latency_quantile') or [])
    assert not (scheduler.get('scheduler_e2e_scheduling_latency') or [])
    assert monitor.component_card_is_empty('scheduler', 'scheduleLatency')
    assert monitor.component_card_chart_series('scheduler', 'scheduleLatency') == []

    # ---- NaN-only 身份（GOT-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-MONITOR-03）：mock 一条全 NaN 的 APPLY ----
    # 真实后端此刻可能已经有 APPLY 数据，所以 NaN 分支用固定响应断言：APPLY 不画 0 线、也不进图例。
    now = int(time.time())
    finite_samples = [[now - 120, "0.003"], [now - 60, "0.004"]]

    def apiserver_with_nan(route):
        route.fulfill(json={"results": [
            {"metric_name": "apiserver_request_by_verb_latencies", "data": {"resultType": "matrix", "result": [
                {"metric": {"__name__": "x", "verb": "APPLY"}, "values": [[now - 120, "NaN"], [now - 60, "NaN"]]},
                {"metric": {"__name__": "x", "verb": "GET"}, "values": finite_samples},
            ]}},
            {"metric_name": "apiserver_request_latencies", "data": {"resultType": "matrix", "result": [
                {"metric": {"__name__": "y"}, "values": finite_samples},
            ]}},
        ]})

    ui.page.route(APISERVER_COMPONENT, apiserver_with_nan)
    monitor.select_range('6h')
    monitor.wait_component_state('apiserver', 'ready')
    mocked = monitor.component_card_series('apiserver', 'requestLatency')
    assert set(mocked) == {'verb:GET', 'apiserver_request_latencies'}, mocked
    assert monitor.component_card_chart_series('apiserver', 'requestLatency') == ['verb:GET', 'apiserver_request_latencies']
    assert _number(mocked['verb:GET']) == pytest.approx(4.0, abs=0.01), mocked['verb:GET']
    ui.page.unroute(APISERVER_COMPONENT)
    monitor.select_range('1h')
    monitor.wait_component_state('apiserver', 'ready')

    # ---- etcd 不在本用例的卡片范围内 ----
    assert monitor.component_card_keys('etcd') == []

    screenshot(ui.page, 'cluster-monitor-components')
