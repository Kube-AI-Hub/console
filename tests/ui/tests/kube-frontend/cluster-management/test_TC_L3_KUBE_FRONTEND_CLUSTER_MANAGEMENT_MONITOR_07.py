from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

from pages.cluster_monitor import ClusterMonitorPage

pytestmark = pytest.mark.ui

SCHEDULER_COMPONENT = re.compile(r'.*/kapis/monitoring\.kubesphere\.io/v1alpha3/components/scheduler(?:\?.*)?$')


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_07(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07 集群监控：组件未上报、请求失败与无权限分支。"""

    ui = cluster_management_page
    assert ui.api is not None
    monitor = ClusterMonitorPage(ui.page, ui.base_url, ui.cluster, ui.api)
    monitor.open()
    monitor.wait_ready()

    # ---- etcd：请求成功但 0 序列 → 明确「未上报」，不显示 0、不显示空白表格 ----
    monitor.wait_component_state('etcd', 'empty')
    not_reported = monitor.component_not_reported('etcd')
    expect(not_reported).to_be_visible(timeout=30_000)
    text = not_reported.inner_text()
    assert '未上报' in text or 'does not report' in text, text
    assert monitor.component_card_keys('etcd') == [], '未上报的组件不应渲染 0 值卡片或空白表格'
    # 结构上证明没有把缺失序列补成 0：没有当前值、没有曲线。
    etcd_group = monitor.component_group('etcd')
    assert etcd_group.locator('[data-ai-id$=":latest"]').count() == 0, 'etcd 子组不应有当前值'
    assert etcd_group.locator('path').count() == 0, 'etcd 子组不应画出任何曲线'
    # 一个组件没有数据，不能拖垮其余组件
    monitor.wait_component_state('apiserver', 'ready')
    monitor.wait_component_state('scheduler', 'ready')

    # ---- 403：显示无权限说明，且没有重试按钮 ----
    def forbidden(route):
        route.fulfill(status=403, json={"message": "forbidden"})

    ui.page.route(SCHEDULER_COMPONENT, forbidden)
    monitor.select_range('6h')
    monitor.wait_component_state('scheduler', 'error')
    error_panel = monitor.component_group('scheduler').locator('[data-ai-id="resource-error"]')
    expect(error_panel).to_be_visible(timeout=30_000)
    error_text = error_panel.inner_text()
    assert '没有权限' in error_text or 'permission' in error_text.lower(), error_text
    assert monitor.component_retry('scheduler').count() == 0, '无权限时不应提供重试'
    monitor.wait_component_state('apiserver', 'ready')

    # ---- 5xx：错误说明 + 重试；点击重试真的再发一次请求 ----
    requests: list[str] = []

    def unavailable(route):
        requests.append(route.request.url)
        route.fulfill(status=500, json={"message": "monitoring unavailable"})

    ui.page.unroute(SCHEDULER_COMPONENT)
    ui.page.route(SCHEDULER_COMPONENT, unavailable)
    monitor.select_range('24h')
    monitor.wait_component_state('scheduler', 'error')
    retry = monitor.component_retry('scheduler')
    expect(retry).to_be_visible(timeout=30_000)
    assert '失败' in error_panel.inner_text() or 'Failed' in error_panel.inner_text(), error_panel.inner_text()
    before = len(requests)
    retry.click()
    deadline = time.time() + 30
    while len(requests) <= before and time.time() < deadline:
        ui.page.wait_for_timeout(200)
    assert len(requests) > before, '点重试后没有重新请求'
    monitor.wait_component_state('scheduler', 'error')

    # ---- 移除失败后重试：子组恢复卡片，说明「重试可用」不是装饰 ----
    ui.page.unroute(SCHEDULER_COMPONENT)
    monitor.component_retry('scheduler').click()
    monitor.wait_component_state('scheduler', 'ready')

    screenshot(ui.page, 'cluster-monitor-components-branches')
