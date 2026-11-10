from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_01(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01 创建：名称格式与重名校验拦住下一步。"""

    # The list is empty on a fresh cluster; seed two objects so the case does
    # not depend on whatever happens to be deployed.
    seeded_configmaps["create"]("case-a", {"key-a": "1"})
    seeded_configmaps["create"]("case-b", {"key-b": "2"})
    # The duplicate-name case needs a name that certainly exists.
    seeded_configmaps["create"]("app-config", {"app.yaml": "a: 1"})

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
