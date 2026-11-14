from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.user_settings import STRENGTH_LABELS

pytestmark = pytest.mark.ui

#: 四条 checklist 全满足、但只有 9 位 → 中
MEDIUM = "Abcdefg1!"
#: 四条 checklist 全满足、12 位 → 强
STRONG = "Abcdefgh123!"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_USER_SETTINGS_PASSWORD_03(user_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-USER_SETTINGS-PASSWORD-03 密码设置：强度面板的四条 checklist、三档强度与进度条。"""

    ui = user_settings_page
    ui.open_from()
    ui.wait_ready()
    ui.select_tab("password")
    expect(ui.new_password).to_be_visible()

    # 规则说明常驻，而且写的就是前端真正强制的规则（含特殊字符）——老 console 的
    # PASSWORD_DESC 只当文案，这里的文案就是规则。
    expect(ui.password_rule).to_be_visible()
    assert "特殊字符" in ui.password_rule.inner_text(), ui.password_rule.inner_text()

    # 新密码为空时面板不渲染：没有输入就没有强度可报。
    assert ui.strength_panel.count() == 0, "新密码为空时不应渲染强度面板"

    # 1) 'abc'：长度、大小写、数字、特殊字符四条都不满足 → 弱。
    ui.new_password.fill("abc")
    expect(ui.strength_panel).to_be_visible()
    expect(ui.strength_panel).to_have_attribute("data-strength", "weak")
    assert ui.checklist() == {"case": False, "digit": False, "special": False, "length": False}, ui.checklist()
    ui.wait_strength_bar(33)
    # 只靠颜色对色盲不可用，三档必须同时有文字。
    assert STRENGTH_LABELS["weak"] in ui.strength_text(), ui.strength_text()

    # 2) 规则全满足但不足 12 位 → 中。
    ui.new_password.fill(MEDIUM)
    expect(ui.strength_panel).to_have_attribute("data-strength", "medium")
    assert ui.checklist() == {"case": True, "digit": True, "special": True, "length": True}, ui.checklist()
    ui.wait_strength_bar(66)
    assert STRENGTH_LABELS["medium"] in ui.strength_text(), ui.strength_text()

    # 3) 规则全满足且 12 位 → 强。
    ui.new_password.fill(STRONG)
    expect(ui.strength_panel).to_have_attribute("data-strength", "strong")
    ui.wait_strength_bar(100)
    assert STRENGTH_LABELS["strong"] in ui.strength_text(), ui.strength_text()

    # 4) checklist 逐条跟随输入：去掉特殊字符后只有 special 翻回未满足，长度仍然满足。
    ui.new_password.fill("Abcdefgh1234")
    expect(ui.strength_panel).to_have_attribute("data-strength", "weak")
    checks = ui.checklist()
    assert checks["special"] is False, checks
    assert checks["length"] is True, checks
    assert checks["case"] is True and checks["digit"] is True, checks

    # 5) 清空后面板消失。
    ui.new_password.fill("")
    expect(ui.strength_panel).to_be_hidden()

    screenshot(ui.page, "user-settings-password-strength")
