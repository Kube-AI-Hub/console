from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import Error, expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_09(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-09 一次点击真实终端、取消与403。"""
    ui = cluster_overview_page
    targets, sockets = [], []
    ui.page.on("request", lambda request: targets.append(request) if "/users/" in request.url and request.url.endswith("/kubectl") else None)
    ui.page.on("websocket", lambda socket: sockets.append(socket))
    ui.open()
    ui.wait_ready()
    assert targets == [] and sockets == []
    ui.control("shortcut:kubectl").click()
    expect(ui.kubectl("terminal")).to_have_attribute("data-ai-state", "ready", timeout=60_000)
    assert ui.page.url == ui.url
    assert len(targets) == 1 and len(sockets) == 1
    marker = f"dashboard-kubectl-{uuid4().hex[:8]}"
    field = ui.terminal_input()
    field.press_sequentially(f"printf '%s%s\\n' '{marker[:10]}' '{marker[10:]}'; kubectl version --client -o json")
    field.press("Enter")
    expect(ui.kubectl("terminal-output")).to_contain_text(marker, timeout=30_000)
    expect(ui.kubectl("terminal-output")).to_contain_text('"gitVersion"')
    screenshot(ui.page, "overview-one-click-kubectl-real")
    with sockets[0].expect_event("close"):
        ui.kubectl("terminal-close").click()
    expect(ui.kubectl("terminal")).to_have_count(0)
    assert ui.page.url == ui.url

    # Cancel an explicitly simulated delayed target; a late response must not reopen it.
    pending = []
    pattern = "**/users/*/kubectl"
    def delayed(route):
        pending.append(route)
    ui.page.route(pattern, delayed)
    with ui.page.expect_request(lambda request: request.url.endswith("/kubectl")):
        ui.control("shortcut:kubectl").click()
    expect(ui.kubectl("preparing")).to_be_visible()
    with ui.page.expect_event("requestfailed", predicate=lambda request: request.url.endswith("/kubectl")):
        ui.kubectl("terminal-close").click()
    expect(ui.page.get_by_role("dialog")).to_have_count(0)
    for route in pending:
        try:
            route.fulfill(json={"namespace": "simulated", "pod": "late", "container": "kubectl"})
        except Error:
            pass  # A canceled browser request may reject the simulated late reply.
    expect(ui.kubectl("terminal")).to_have_count(0)
    assert len(sockets) == 1
    ui.page.unroute(pattern, delayed)
    ui.page.route(pattern, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    ui.control("shortcut:kubectl").click()
    expect(ui.page.get_by_role("dialog")).to_be_visible()
    expect(ui.kubectl("retry")).to_have_count(0)
    expect(ui.page.get_by_role("dialog")).to_contain_text("权限")
    screenshot(ui.page, "overview-kubectl-forbidden-simulated")
    ui.kubectl("terminal-close").click()
    expect(ui.page.get_by_role("dialog")).to_have_count(0)
