from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

KAPIS = "/kapis/alerting.kubesphere.io/v2beta1"
REQUIRED = ["消息", "状态", "级别", "告警策略", "监控目标", "触发时间"]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_ALERTS_02(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-02 告警消息：项目列表读聚合 v2beta1 集合与旧列。"""

    ui = monitoring_page
    assert ui.api is not None

    requests: list[str] = []
    ui.page.on("request", lambda request: requests.append(request.url))

    ui.open("alerts")
    ui.wait_ready("alerts")

    assert any(f"{KAPIS}/namespaces/{ui.namespace}/alerts" in url for url in requests), (
        "页面没有请求聚合 v2beta1 的项目告警集合: " + "\n".join(requests[:5])
    )
    assert not any("/kapis/alerting.kubesphere.io/v1alpha2" in url for url in requests), (
        "页面仍在读 v1alpha2（该组在本部署返回 200 空体）"
    )

    status, body = ui.api.request("GET", f"{KAPIS}/namespaces/{ui.namespace}/alerts?limit=1")
    assert status == 200, status
    total = int(body.get("totalItems") or 0)
    state = ui.state("alerts")

    if total == 0:
        assert state == "empty", f"接口 0 条时页面应为 empty，实际 {state}"
        surface = ui.surface("alerts")
        assert surface.locator("thead").count() == 0, "空列表不应渲染表头"
        assert "暂无告警消息" in surface.inner_text()
    else:
        assert state == "ready", f"接口 {total} 条时页面应为 ready，实际 {state}"
        headers = ui.headers("alerts")
        positions = [headers.index(label) for label in REQUIRED if label in headers]
        assert len(positions) == len(REQUIRED), f"缺少列: {set(REQUIRED) - set(headers)}"
        assert positions == sorted(positions), f"列顺序错误: {headers}"
        footer = ui.surface("alerts").inner_text()
        assert f"共 {total} 条" in footer, f"分页总数与接口不一致: {footer[-200:]}"
        row = ui.rows("alerts").first
        row.locator('button[aria-haspopup="menu"]').click()
        names = ui.page.get_by_role("menuitem").all_inner_texts()
        assert "详情" in names, names
        assert "删除" not in names, f"聚合告警 API 没有 item DELETE 路由，不应提供删除: {names}"
        ui.page.keyboard.press("Escape")

    screenshot(ui.page, "monitoring-alerts-aggregated")
