from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_03(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03 创建：YAML 模式拒绝非法语法，合法时提交。"""

    configmaps_page.open()
    configmaps_page.wait_ready()
    configmaps_page.create_button.click()

    configmaps_page.dialog.get_by_role("button", name="编辑 YAML").click()
    editor = configmaps_page.dialog.locator(".cm-content")
    expect(editor).to_be_visible()

    editor.click()
    configmaps_page.page.keyboard.press("ControlOrMeta+a")
    configmaps_page.page.keyboard.type("this: [is: not: valid")
    expect(configmaps_page.dialog.get_by_text("YAML 格式有误")).to_be_visible()

    screenshot(configmaps_page.page, "create-yaml-invalid")
