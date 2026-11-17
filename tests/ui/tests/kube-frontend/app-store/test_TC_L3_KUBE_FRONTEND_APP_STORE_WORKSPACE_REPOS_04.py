from __future__ import annotations

import json

import pytest
from playwright.sync_api import expect

from helpers.access_review import install_access_review_mock

pytestmark = pytest.mark.ui

WS = "system-workspace"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_WORKSPACE_REPOS_04(ui_config, page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-04 企业空间应用仓库：权限门控与中英文文案。"""

    origin = ui_config.app
    path = f"/kube-frontend/workspaces/{WS}/repos"

    # --- 中文：不得出现英文串（本单元修掉的 locale 反串缺陷） ---
    page.goto(origin + path)
    page.evaluate("window.localStorage.setItem('kube-frontend-locale', 'zh')")
    page.goto(origin + path)
    create_button = page.locator('[data-ai-id="workspace-repos:create"]')
    expect(create_button).to_be_visible(timeout=60_000)
    expect(create_button).to_contain_text("添加仓库")
    assert "Add repository" not in create_button.inner_text()
    screenshot(page, "workspace-repos-zh")

    # --- 英文：同一批文案必须是英文 ---
    page.evaluate("window.localStorage.setItem('kube-frontend-locale', 'en')")
    page.goto(origin + path)
    create_button = page.locator('[data-ai-id="workspace-repos:create"]')
    expect(create_button).to_be_visible(timeout=60_000)
    expect(create_button).to_contain_text("Add repository")
    assert "添加仓库" not in create_button.inner_text()
    screenshot(page, "workspace-repos-en")

    # --- 权限明确拒绝：写入入口不可用并说明（fail-open 的反面） ---
    page.evaluate("window.localStorage.setItem('kube-frontend-locale', 'zh')")
    install_access_review_mock(page, lambda attributes: False)
    page.goto(origin + path)
    create_button = page.locator('[data-ai-id="workspace-repos:create"]')
    expect(create_button).to_be_visible(timeout=60_000)
    expect(create_button).to_be_disabled(timeout=60_000)
    expect(page.locator('[data-ai-id="workspace-repos:surface"]').last).to_contain_text("写入入口已隐藏")

    # 行操作里不再出现写入动作。
    surface = page.locator('[data-ai-id="workspace-repos:surface"]').last
    more = surface.get_by_role("button", name="更多操作")
    if more.count() > 0:
        more.first.click()
        page.wait_for_timeout(500)
        assert page.get_by_role("menuitem", name="编辑", exact=True).count() == 0
        page.keyboard.press("Escape")

    # --- 探测失败：保持可用（fail-open） ---
    page.unroute("**/selfsubjectaccessreviews")
    page.route(
        "**/kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews",
        lambda route: route.fulfill(status=500, content_type="application/json", body="{}"),
    )
    page.goto(origin + path)
    create_button = page.locator('[data-ai-id="workspace-repos:create"]')
    expect(create_button).to_be_visible(timeout=60_000)
    expect(create_button).to_be_enabled(timeout=60_000)
    screenshot(page, "workspace-repos-permission")
