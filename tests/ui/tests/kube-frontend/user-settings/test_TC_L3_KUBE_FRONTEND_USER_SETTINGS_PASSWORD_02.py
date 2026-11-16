from __future__ import annotations

import re
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.login import LoginPage

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_USER_SETTINGS_PASSWORD_02(temp_user, settings_page_for, screenshot):
    """TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-02 密码设置：当前密码错误留在弹窗，改成功后自动退出且旧密码失效。"""

    user = temp_user()
    # 带特殊字符：前端要求，否则还没发请求就会被「密码需包含特殊字符」拦下。
    new_password = f"TcE2e@{uuid4().hex[:6].upper()}8"

    ui = settings_page_for(user["name"], user["password"])
    ui.open_from()
    ui.wait_ready()
    ui.select_tab("password")
    expect(ui.current_password).to_be_visible()

    # 1) 当前密码错误：弹窗留在原地并说明原因，不显示成功提示。
    ui.fill_password("WrongPass1", new_password, new_password)
    ui.save_password()
    expect(ui.password_error).to_have_text("当前密码不正确。")
    expect(ui.surface).to_be_visible()
    assert not ui.password_saved.is_visible(), "当前密码错误时不应显示成功提示"

    # 2) 当前密码正确：改密成功，1.2 秒后自动签出并跳登录页。
    ui.fill_password(user["password"], new_password, new_password)
    ui.save_password()
    expect(ui.password_saved).to_be_visible()

    login = LoginPage(ui.page, ui.base_url)
    # 不用 wait_for_url：签出会触发两次导航（路由守卫 + location.assign），那个 API 会抛
    # net::ERR_ABORTED。轮询地址则是安全的。
    expect(ui.page).to_have_url(re.compile(r"/kube-frontend/login"), timeout=30_000)
    expect(login.surface).to_be_visible()

    # 3) 旧密码登不进去。
    login.sign_in(user["name"], user["password"])
    expect(login.error_panel).to_be_visible()
    assert login.state == "error", "旧密码登录应停在失败态"

    # 4) 新密码登得进去。
    login.sign_in(user["name"], new_password)
    expect(ui.account_menu).to_be_visible(timeout=60_000)
    expect(login.surface).to_be_hidden()

    screenshot(ui.page, "user-settings-password-changed")
