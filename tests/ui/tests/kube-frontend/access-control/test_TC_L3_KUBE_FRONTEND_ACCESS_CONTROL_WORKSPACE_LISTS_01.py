from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_LISTS_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01 企业空间控制台列表刷新与空态出口。"""

    ui = access_control_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    # Every list of this console owns its query and must carry the control, enabled when idle.
    for handle in ("workspace-roles", "workspace-projects", "workspace-quota"):
        ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/{handle.replace('workspace-', '')}")
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        # A permanently disabled button is the signature of a schema memo that never sees the
        # query settle, which is the bug this case exists to catch.
        expect(button).to_be_enabled(timeout=60_000)

    # Clicking refresh re-issues the list request.
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/projects")
    surface = ui.page.locator('[data-ai-id="workspace-projects:surface"]').last
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    refresh = ui.page.locator('[data-ai-id="workspace-projects:refresh"]')
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(lambda request: "/namespaces" in request.url and "labelSelector" in request.url, timeout=30_000):
        refresh.click()

    screenshot(ui.page, "workspace-lists-refresh")
