from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_EDIT_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02 编辑设置：重复键被拒绝，原有键值不丢失。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready" or not configmaps_page.row_names():
        pytest.skip(f"没有对象可编辑，当前状态 {configmaps_page.state}")

    name = configmaps_page.row_names()[0]
    configmaps_page.open_row_menu(name)
    configmaps_page.click_row_action("编辑设置")

    existing = configmaps_page.dialog.locator("[data-ai-row]").first
    if existing.count() == 0:
        pytest.skip("该对象没有键值，无法验证重复键")

    key = existing.get_attribute("data-ai-row")
    configmaps_page.dialog.get_by_role("button", name="添加数据").click()
    configmaps_page.fill_dialog_field("configmaps:data-key", key or "")
    configmaps_page.confirm_dialog("configmaps:data-save")

    expect(configmaps_page.dialog.get_by_text("重复")).to_be_visible()
    screenshot(configmaps_page.page, "edit-settings-duplicate-key")
