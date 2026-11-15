from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_APPSTORE_LISTS_REFRESH_01(ui_config, page, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-APPSTORE_LISTS_REFRESH-01 应用商店列表刷新。"""

    origin = ui_config.app
    for handle, path in (
        ("workspace-apps", f"/kube-frontend/workspaces/{WS}/apps"),
        ("workspace-repos", f"/kube-frontend/workspaces/{WS}/repos"),
    ):
        page.goto(origin + path)
        button = page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        # A disabled button is the fingerprint of a schema memo that never sees the query settle.
        expect(button).to_be_enabled(timeout=60_000)

    # Clicking refresh re-issues the application list request.
    page.goto(origin + f"/kube-frontend/workspaces/{WS}/apps")
    refresh = page.locator('[data-ai-id="workspace-apps:refresh"]')
    expect(refresh).to_be_enabled(timeout=60_000)
    with page.expect_request(lambda request: request.method == "GET" and "/apps" in request.url, timeout=30_000):
        refresh.click()

    # The manage store pages keep their single page-level refresh instead of gaining a second one.
    page.goto(origin + "/kube-frontend/apps-manage/store")
    page.wait_for_timeout(4000)
    expect(page.locator('[data-ai-id$=":refresh"]')).to_have_count(1, timeout=30_000)
    screenshot(page, "appstore-lists-refresh")
