from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.core
def test_TC_L2_KUBE_FRONTEND_LOGIN_02(anonymous_page, ui_config, login_page, screenshot):
    """TC-L2-KUBE-FRONTEND-LOGIN-02 空提交与错误密码各自提示，且不写入 token。"""

    page = anonymous_page
    login_page.open()

    # 1. Empty submit: both fields complain, and no request leaves the browser.
    requests: list[str] = []
    page.on("request", lambda request: requests.append(request.url) if "session/login" in request.url else None)
    login_page.submit.click()
    expect(page.locator('p[role="alert"]')).to_have_count(2)
    assert requests == [], requests

    # 2. Username only: the password is the field at fault.
    login_page.username.fill(ui_config.username)
    login_page.submit.click()
    expect(page.locator('p[role="alert"]')).to_have_count(1)
    assert requests == [], requests

    # 3. Wrong password: one message, password cleared, user kept, no token.
    login_page.sign_in(ui_config.username, "definitely-not-the-password")
    expect(login_page.error_panel).to_be_visible()
    assert "用户名或密码不正确" in login_page.error_panel.inner_text()
    assert login_page.password.input_value() == ""
    assert login_page.username.input_value() == ui_config.username
    assert page.evaluate("() => localStorage.getItem('kubesphere-token')") is None
    screenshot(page, "login-failure")
