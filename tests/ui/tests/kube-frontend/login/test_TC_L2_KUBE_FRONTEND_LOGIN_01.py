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
    login_page.sign_in(ui_config.login_user, ui_config.login_pass)
    page.wait_for_url(f"**{destination}")

    # The destination is all this case is about. Whether the list behind it has
    # data is a permission question — the login account deliberately has none —
    # and asserting `ready` here would fail for a reader who merely cannot see
    # the project, which is not a login defect.
    expect(page.locator('[data-ai-id="configmaps:surface"]')).to_be_visible()
    assert page.evaluate("() => !!localStorage.getItem('kubesphere-token')")
    screenshot(page, "login-return-path")
