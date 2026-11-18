from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: The conditional etcd tab exists only when the ServiceMonitor probe answers 200.
SERVICEMONITOR = "**/servicemonitors/etcd*"
ETCD_COMPONENT = "**/monitoring.kubesphere.io/v1alpha3/components/etcd**"


def _etcd_visible(ui, timeout: float = 30.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if ui.etcd_tab().count() > 0 and ui.etcd_tab().is_visible():
            return True
        ui.page.wait_for_timeout(250)
    return False


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_07(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-07 集群监控：组件未上报、请求失败与无权限分支。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    # ---- this deployment has no etcd ServiceMonitor (404): no etcd tab, deep link falls back ----
    ui.open()
    ui.wait_ready()
    assert ui.etcd_tab().count() == 0, "404 时不应渲染条件 etcd 页签"
    ui.page.goto(f"{ui.url}?tab=etcd")
    ui.wait_ready()
    assert ui.active_tab() == "overview", f"?tab=etcd 在页签隐藏时应回退 overview: {ui.active_tab()}"

    # ---- probe 200: the conditional tab appears and shows the「未上报」branch ----
    ui.page.route(SERVICEMONITOR, lambda route: route.fulfill(status=200, json={"metadata": {"name": "etcd"}}))
    try:
        ui.page.goto(ui.url)
        ui.wait_ready()
        assert _etcd_visible(ui), "ServiceMonitor 200 时应渲染 etcd 页签"
        ui.etcd_tab().click()
        expect(ui.etcd_tabpanel()).to_be_visible(timeout=30_000)
        expect(ui.etcd_no_data()).to_be_visible(timeout=30_000)
        no_data_text = ui.etcd_no_data().inner_text()
        assert "未上报" in no_data_text or "does not report" in no_data_text, no_data_text
        assert ui.etcd_chart_ids() == [], "未上报的组件不应渲染 0 值卡片"
        assert ui.etcd_tabpanel().locator("path[data-ai-trend-line]").count() == 0, "未上报时不应画任何曲线"
        screenshot(ui.page, "cluster-monitor-etcd-not-reported")
    finally:
        ui.page.unroute(SERVICEMONITOR)

    # ---- probe 200 + etcd component 500: error + retry; other tabs stay usable ----
    requests: list[str] = []

    def unavailable(route):
        requests.append(route.request.url)
        route.fulfill(status=500, json={"message": "etcd component unavailable"})

    ui.page.route(SERVICEMONITOR, lambda route: route.fulfill(status=200, json={"metadata": {"name": "etcd"}}))
    ui.page.route(ETCD_COMPONENT, unavailable)
    try:
        ui.page.goto(ui.url)
        ui.wait_ready()
        assert _etcd_visible(ui), "500 分支也需要 etcd 页签可见"
        ui.etcd_tab().click()
        panel = ui.etcd_tabpanel()
        expect(panel.locator('[data-ai-id="resource-error"]').first).to_be_visible(timeout=30_000)
        retry = ui.etcd_retry()
        expect(retry).to_be_visible(timeout=30_000)
        before = len(requests)
        retry.click()
        deadline = time.time() + 30
        while time.time() < deadline and len(requests) <= before:
            ui.page.wait_for_timeout(200)
        assert len(requests) > before, "点重试后没有重新请求 etcd 组件"

        # One component failing must not blank the other tabs.
        ui.select_tab("apiserver")
        ui.wait_ready()
        assert sorted(ui.apiserver_chart_ids()) == ["latency", "rate"], "etcd 失败不应清空 apiserver 页签"
        expect(ui.apiserver_chart("latency")).to_be_visible(timeout=30_000)
    finally:
        ui.page.unroute(ETCD_COMPONENT)

    # ---- probe 200 + etcd component 403: permission, no retry ----
    ui.page.route(ETCD_COMPONENT, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    try:
        ui.page.goto(ui.url)
        ui.wait_ready()
        assert _etcd_visible(ui)
        ui.etcd_tab().click()
        panel = ui.etcd_tabpanel()
        expect(panel.locator('[data-ai-id="resource-error"]').first).to_be_visible(timeout=30_000)
        assert "无权限" in panel.inner_text() or "权限" in panel.inner_text(), panel.inner_text()[:200]
        assert ui.etcd_retry().count() == 0, "无权限时不应提供重试"
    finally:
        ui.page.unroute(ETCD_COMPONENT)
        ui.page.unroute(SERVICEMONITOR)

    # ---- remove every interception: the strip is back to the base five tabs ----
    ui.page.goto(ui.url)
    ui.wait_ready()
    assert ui.etcd_tab().count() == 0, "404 恢复后 etcd 页签应再次隐藏"
    assert ui.tab_ids() == ["overview", "resource", "apiserver", "scheduler", "ranking"], ui.tab_ids()
    screenshot(ui.page, "cluster-monitor-etcd-branches")
