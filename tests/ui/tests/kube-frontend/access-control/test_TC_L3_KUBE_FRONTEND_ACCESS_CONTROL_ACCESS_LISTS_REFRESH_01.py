from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_ACCESS_LISTS_REFRESH_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01 访问控制列表刷新。"""

    ui = access_control_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    pages = [
        ("users", f"{origin}/kube-frontend/access/users"),
        ("cluster-members", f"{origin}/kube-frontend/clusters/{CLUSTER}/members"),
        ("clusters", f"{origin}/kube-frontend/clusters"),
        ("federated-projects", f"{origin}/kube-frontend/workspaces/{WS}/federatedprojects"),
    ]
    for handle, url in pages:
        ui.page.goto(url)
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        # A disabled button is the fingerprint of a schema memo that never sees the query settle.
        expect(button).to_be_enabled(timeout=60_000)

    # Clicking refresh re-issues the platform user request.
    ui.page.goto(f"{origin}/kube-frontend/access/users")
    refresh = ui.page.locator('[data-ai-id="users:refresh"]')
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(
        lambda request: "users" in request.url and request.method == "GET", timeout=30_000
    ):
        refresh.click()
    screenshot(ui.page, "access-lists-refresh")
