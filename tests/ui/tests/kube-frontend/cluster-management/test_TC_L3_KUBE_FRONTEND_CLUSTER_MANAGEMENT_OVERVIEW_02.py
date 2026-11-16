from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_02(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02 概览布局、快捷入口与部分缺值。"""
    ui = cluster_overview_page
    requests = []
    ui.page.on("request", lambda request: requests.append(request))
    ui.open()
    ui.wait_ready()
    expect(ui.usage_row("cpu")).to_be_visible(timeout=30_000)
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 1000})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        screenshot(ui.page, f"overview-layout-{width}")
    for page in ("nodes", "gpus", "monitor"):
        expect(ui.page.locator(f'[data-ai-id="overview:shortcut:{page}"]')).to_have_attribute(
            "href", f"/kube-frontend/clusters/{ui.cluster}/{page}")
    sockets = []
    ui.page.on("websocket", lambda socket: sockets.append(socket.url))
    expect(ui.control("shortcut:kubectl")).to_be_visible()
    expect(ui.page.get_by_role("dialog")).to_have_count(0)
    assert sockets == [], "页面挂载不得自动连接终端"
    assert not any("/users/" in request.url and "/kubectl" in request.url for request in requests)
    ui.open()
    ui.wait_ready()
    requests.clear()
    with ui.page.expect_response(lambda response: "/monitoring.kubesphere.io/v1alpha3/cluster?" in response.url):
        ui.page.locator('[data-ai-id="overview:refresh"]').click()
    assert not any("/monitoring.kubesphere.io/v1alpha3/nodes" in request.url and "type=rank" not in request.url for request in requests)

    # These are explicitly simulated responses, separate from the real-layout checks.
    def partial(route):
        values = {"cluster_cpu_usage": 0, "cluster_cpu_total": 8,
                  "cluster_pod_running_count": 0, "cluster_pod_quota": 0}
        route.fulfill(json={"results": [
            {"metric_name": name, "data": {"result": [{"metric": {}, "value": [1, str(value)]}]}}
            for name, value in values.items()
        ]})

    ui.page.route("**/monitoring.kubesphere.io/v1alpha3/cluster?*", partial)
    ui.page.reload()
    ui.wait_ready()
    expect(ui.usage_row("cpu")).to_contain_text("0%")
    expect(ui.usage_row("cpu").get_by_role("progressbar")).to_have_attribute("aria-valuenow", "0")
    expect(ui.usage_field("memory", "used")).to_have_text("-")
    expect(ui.usage_field("memory", "total")).to_have_text("-")
    expect(ui.usage_row("memory").get_by_role("progressbar")).to_have_count(0)
    expect(ui.usage_row("pods").get_by_role("progressbar")).to_have_count(0)
    assert "%" not in ui.usage_text("pods")
    assert ui.field_text("kubernetes-version")
    assert not any(request.method in ("PUT", "PATCH", "DELETE") for request in requests)
    screenshot(ui.page, "overview-partial-metrics-simulated")
