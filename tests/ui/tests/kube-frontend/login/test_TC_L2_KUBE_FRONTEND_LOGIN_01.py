from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.core
def test_TC_L2_KUBE_FRONTEND_LOGIN_01(anonymous_page, ui_config, login_page, screenshot):
    """TC-L2-KUBE-FRONTEND-LOGIN-01 未登录访问深链接 → 登录 → 回到原页面。"""

    page = anonymous_page
    destination = "/kube-frontend/system-workspace/clusters/host/projects/default/configmaps"

    # 1. A protected deep link goes to /login and keeps the destination.
    page.goto(f"{ui_config.base_url}{destination}")
    page.wait_for_url("**/login**")
    expect(login_page.surface).to_be_visible()

    query = parse_qs(urlparse(page.url).query)
    assert query.get("redirect") == [destination], query

    # 2. Signing in lands on the destination rather than the home page.
    login_page.sign_in(ui_config.username, ui_config.password)
    page.wait_for_url(f"**{destination}")

    surface = page.locator('[data-ai-id="configmaps:surface"]')
    expect(surface).to_be_visible()
    # The list issues its own request after the redirect, so wait for it rather
    # than sampling the attribute once: right after navigation it is `loading`.
    expect(surface).not_to_have_attribute("data-ai-state", "loading")
    assert surface.get_attribute("data-ai-state") in {"ready", "empty"}
    assert page.evaluate("() => !!localStorage.getItem('kubesphere-token')")
    screenshot(page, "login-return-path")
