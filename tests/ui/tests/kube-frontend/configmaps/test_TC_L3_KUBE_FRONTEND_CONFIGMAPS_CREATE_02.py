from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02 创建：两步表单录入键值后提交成功。"""

    configmaps_page.open()
    configmaps_page.wait_ready()
    configmaps_page.create_button.click()

    unique = f"tc-create-{int(time.time())}"
    configmaps_page.fill_dialog_field("configmaps:field-name", unique)
    configmaps_page.confirm_dialog("configmaps:create-next")

    configmaps_page.dialog.get_by_role("button", name="添加数据").click()
    configmaps_page.fill_dialog_field("configmaps:data-key", "greeting")
    configmaps_page.fill_dialog_field("configmaps:data-value", "hello")
    configmaps_page.confirm_dialog("configmaps:data-save")

    configmaps_page.confirm_dialog("configmaps:create-submit")
    expect(configmaps_page.dialog).to_be_hidden()

    configmaps_page.wait_ready()
    assert unique in configmaps_page.row_names(), configmaps_page.row_names()
    screenshot(configmaps_page.page, "create-result")
