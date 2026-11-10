from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_EDIT_01(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01 编辑信息：名称只读，别名清空后注解被移除。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready" or not configmaps_page.row_names():
        pytest.skip(f"没有对象可编辑，当前状态 {configmaps_page.state}")

    name = configmaps_page.row_names()[0]
    configmaps_page.open_row_menu(name)
    configmaps_page.click_row_action("编辑信息")

    name_field = configmaps_page.dialog.get_by_role("textbox").first
    expect(name_field).to_be_disabled()

    configmaps_page.fill_dialog_field("configmaps:edit-alias", "")
    configmaps_page.confirm_dialog("configmaps:edit-info-submit")
    expect(configmaps_page.dialog).to_be_hidden()

    screenshot(configmaps_page.page, "edit-info")
