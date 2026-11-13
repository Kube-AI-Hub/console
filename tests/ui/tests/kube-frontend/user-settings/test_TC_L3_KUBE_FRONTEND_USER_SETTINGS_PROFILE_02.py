from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.user_settings import annotations_of, spec_email_of

pytestmark = pytest.mark.ui

#: 邮箱校验的提示语（locales 的 userSettings.profile.error.email）。
EMAIL_ERROR = "请输入合法的邮箱地址。"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_USER_SETTINGS_PROFILE_02(temp_user, settings_page_for, screenshot):
    """TC-L3-KUBE-FRONTEND-USER_SETTINGS-PROFILE-02 基本信息：邮箱非法时本地拒绝，合法时整对象 PUT 且注解不变。"""

    description = "tc-e2e user-settings profile"
    user = temp_user(description=description)
    ui = settings_page_for(user["name"], user["password"])
    ui.open_from()
    ui.wait_ready()

    before = ui.get_user(user["name"])
    assert spec_email_of(before) == user["email"], "临时账号的 spec.email 应由夹具写入"
    expect(ui.email_input).to_have_value(user["email"])

    ui.reset_writes()

    # 1) 邮箱为空：本地校验挡下，不发写请求。
    ui.fill_email("")
    ui.save_profile()
    expect(ui.profile_error).to_have_text(EMAIL_ERROR)
    assert ui.user_writes(user["name"]) == [], "邮箱为空时不该发写请求"

    # 2) 格式非法：同样在本地挡下。
    ui.fill_email("not-an-email")
    ui.save_profile()
    expect(ui.profile_error).to_have_text(EMAIL_ERROR)
    assert ui.user_writes(user["name"]) == [], "邮箱格式非法时不该发写请求"

    # 3) 合法：整对象 PUT 成功，回读 spec.email 为新值。
    new_email = f"{user['name']}.new@example.com"
    ui.fill_email(new_email)
    ui.save_profile()
    expect(ui.profile_saved).to_be_visible()
    writes = ui.user_writes(user["name"])
    assert [entry.split(" ", 1)[0] for entry in writes] == ["PUT"], writes

    after = ui.get_user(user["name"])
    assert spec_email_of(after) == new_email, spec_email_of(after)
    # 整对象 PUT 最危险的副作用：漏带注解等于顺手把人降权。
    assert annotations_of(after)["iam.kubesphere.io/platform-role"] == "platform-regular"
    assert annotations_of(after)["kubesphere.io/description"] == description

    screenshot(ui.page, "user-settings-profile-saved")
