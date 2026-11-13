from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_USER_SETTINGS_PASSWORD_01(temp_user, settings_page_for, screenshot):
    """TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-01 密码设置：必填、规则与一致性在本地拦下且不发请求。"""

    user = temp_user()
    ui = settings_page_for(user["name"], user["password"])
    ui.open_from()
    ui.wait_ready()
    ui.select_tab("password")
    expect(ui.current_password).to_be_visible()

    ui.reset_writes()

    # 1) 三项都空。
    ui.save_password()
    expect(ui.password_error).to_have_text("请填写当前密码、新密码与确认密码。")

    # 2) 新密码缺大写字母：8 位以上、有小写字母与数字，仍然不合平台规则。
    ui.fill_password(user["password"], "abcdefgh1", "abcdefgh1")
    ui.save_password()
    expect(ui.password_error).to_have_text("密码需包含大写字母。")

    # 3) 太短：'Abc1' 类别齐全但只有 4 位。
    ui.fill_password(user["password"], "Abc1", "Abc1")
    ui.save_password()
    expect(ui.password_error).to_have_text("密码至少 8 位。")

    # 4) 太长：上限按 UTF-8 字节算。30 个汉字只有 30 个字符，却是 90 字节——按字符数
    #    判断会放行，服务端随后用 422「Too long: may not be more than 64 bytes」拒绝。
    too_long = "汉" * 30
    assert len(too_long) == 30, "字符数没有超过上限，超的是字节数"
    ui.fill_password(user["password"], too_long, too_long)
    ui.save_password()
    expect(ui.password_error).to_have_text("密码不能超过 64 字节。")

    # 5) 两次输入不一致（两个值各自都合规）。
    ui.fill_password(user["password"], "TcE2e2026x", "TcE2e2026y")
    ui.save_password()
    expect(ui.password_error).to_have_text("两次输入的密码必须一致。")

    writes = ui.user_writes(user["name"])
    assert writes == [], f"本地校验没通过却发了写请求：{writes}"
    # 被拒的只是这一次提交：弹窗还在，也没有被签出。
    expect(ui.surface).to_be_visible()
    expect(ui.password_saved).to_be_hidden()

    screenshot(ui.page, "user-settings-password")
