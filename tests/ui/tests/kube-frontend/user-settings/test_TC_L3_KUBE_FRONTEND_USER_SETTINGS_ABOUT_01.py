from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

VERSION = "/kapis/version"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_USER_SETTINGS_ABOUT_01(page, session_token, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01 关于与版本。"""

    from helpers.api import ApiClient

    api = ApiClient(ui_config.app, session_token)
    status, version = api.request("GET", VERSION)
    assert status == 200, (status, version)
    console_version = (version or {}).get("gitVersion") or ""
    kubernetes_version = ((version or {}).get("kubernetes") or {}).get("gitVersion") or ""

    page.goto(f"{ui_config.app}/kube-frontend/access/users")
    menu = page.locator('[data-ai-id="shell:user-menu"]')
    expect(menu).to_be_visible(timeout=60_000)
    menu.click()

    about = page.locator('[data-ai-id="shell:about"]')
    expect(about).to_be_visible(timeout=20_000)
    about.click()

    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=20_000)
    expect(page.locator('[data-ai-id="shell-about:surface"]')).to_be_visible()
    # The name comes from the platform config and falls back to the product name; either way it is
    # not empty, which is the property a hard-coded-but-forgotten title would violate.
    assert page.locator('[data-ai-id="shell-about:title"]').inner_text().strip(), "关于弹窗标题为空"

    if console_version or kubernetes_version:
        expect(page.locator('[data-ai-id="shell-about:console-version"]')).to_contain_text(console_version or "-")
        expect(page.locator('[data-ai-id="shell-about:kubernetes-version"]')).to_contain_text(kubernetes_version or "-")
    else:
        expect(page.locator('[data-ai-id="shell-about:unavailable"]')).to_be_visible(timeout=20_000)
    screenshot(page, "shell-about")
