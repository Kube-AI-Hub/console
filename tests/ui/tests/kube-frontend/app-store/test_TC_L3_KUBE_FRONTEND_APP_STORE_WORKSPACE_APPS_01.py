from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
APPS = f"/kapis/openpitrix.io/v1/workspaces/{WS}/apps"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_WORKSPACE_APPS_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-01 企业空间应用模板：列表、表头与刷新。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{APPS}?limit=-1")
    assert status == 200, f"GET {APPS} -> {status}: {str(body)[:300]}"
    items = (body or {}).get("items") or []

    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/apps")
    surface = ui.page.locator('[data-ai-id="workspace-apps:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    state = surface.get_attribute("data-ai-state")
    if items:
        assert state == "ready", f"expected ready, got {state}"
        headers = [value.strip() for value in surface.locator("thead th:visible").all_inner_texts() if value.strip()]
        for expected_header in ("名称", "状态", "最新版本", "版本类型", "更新时间", "创建时间"):
            assert expected_header in headers, headers
        expect(surface.locator("tbody tr[data-ai-row]")).to_have_count(len(items), timeout=30_000)
    else:
        assert state == "empty", f"expected empty, got {state}"
        assert "还没有应用" in surface.inner_text()

    # 刷新按钮可用，且点击真的重新请求（不是只存在）。
    refresh = ui.page.locator('[data-ai-id="workspace-apps:refresh"]')
    expect(refresh).to_be_visible(timeout=60_000)
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(
        lambda request: request.method == "GET" and "/workspaces/" in request.url and request.url.split("?")[0].endswith("/apps"),
        timeout=30_000,
    ):
        refresh.click()
    screenshot(ui.page, "workspace-apps-list")
