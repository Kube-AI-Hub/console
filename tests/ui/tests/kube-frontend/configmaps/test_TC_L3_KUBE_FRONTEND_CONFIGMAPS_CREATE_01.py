from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_01(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01 创建：名称格式与重名校验拦住下一步。"""

    configmaps_page.open()
    configmaps_page.wait_ready()
    configmaps_page.create_button.click()

    configmaps_page.fill_dialog_field("configmaps:field-name", "Bad_Name")
    configmaps_page.confirm_dialog("configmaps:create-next")
    expect(configmaps_page.dialog.get_by_text("名称无效")).to_be_visible()

    configmaps_page.fill_dialog_field("configmaps:field-name", "app-config")
    configmaps_page.confirm_dialog("configmaps:create-next")
    expect(configmaps_page.dialog.get_by_text("名称已存在，请输入其他名称。")).to_be_visible()

    screenshot(configmaps_page.page, "create-name-validation")
