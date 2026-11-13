from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_USER_SETTINGS_01(user_settings_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-USER_SETTINGS-01 用户设置：从账号菜单打开、两页签切换、关闭不提交。"""

    ui = user_settings_page
    ui.open_from()
    ui.wait_ready()

    # 默认落在「基本信息」：邮箱可编辑，密码三项根本没渲染。
    expect(ui.email_input).to_be_visible()
    assert ui.current_password.count() == 0, "基本信息页签下不应渲染密码输入框"

    # 从这里开始记写请求：切换页签与关闭都不该提交任何东西。
    ui.reset_writes()

    ui.select_tab("password")
    expect(ui.current_password).to_be_visible()
    expect(ui.new_password).to_be_visible()
    expect(ui.confirm_password).to_be_visible()
    assert ui.email_input.count() == 0, "切到「密码设置」后邮箱输入框应消失"

    ui.select_tab("profile")
    expect(ui.email_input).to_be_visible()
    assert ui.current_password.count() == 0, "切回「基本信息」后密码输入框应消失"

    url = ui.page.url
    ui.close()
    assert not ui.is_open, "点关闭后弹窗应消失"
    assert ui.page.url == url, f"关闭弹窗不应离开原页面（当前 {ui.page.url}）"
    expect(ui.account_menu).to_be_visible()
    assert ui.writes == [], f"没有点保存却发出了写请求：{ui.writes}"

    screenshot(ui.page, "user-settings-tabs")
