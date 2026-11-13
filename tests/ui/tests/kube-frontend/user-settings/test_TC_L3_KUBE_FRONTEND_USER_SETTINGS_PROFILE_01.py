from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.user_settings import platform_role_of, spec_email_of

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_USER_SETTINGS_PROFILE_01(user_settings_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-01 基本信息：用户名与平台角色只读，邮箱初值等于接口值。"""

    ui = user_settings_page
    # 期望值取自接口而不是页面：邮箱的权威值在 spec.email，平台角色在注解里。
    user = ui.get_user(ui_config.username)
    expected_email = spec_email_of(user)
    expected_role = platform_role_of(user)

    ui.open_from()
    ui.wait_ready()

    expect(ui.username).to_have_text(ui_config.username)
    expect(ui.platform_role).to_have_text(expected_role)
    expect(ui.email_input).to_have_value(expected_email)

    # 「只读」按元素本身能不能输入判定，不看类名或 disabled 属性。
    assert ui.is_editable("username") is False, "用户名应只读"
    assert ui.is_editable("platform-role") is False, "平台角色应只读"
    assert ui.is_editable("email") is True, "邮箱应可编辑"

    screenshot(ui.page, "user-settings-profile")
