from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_02(configmaps_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02 创建：两步表单录入键值后提交成功。"""

    # A second-resolution timestamp collided when two runs landed in the same
    # second, and nothing ever deleted the objects this case creates, so the
    # project accumulated dozens of them and the list assertions drifted.
    unique = f"tc-create-{uuid.uuid4().hex[:10]}"

    configmaps_page.open()
    configmaps_page.wait_ready()
    configmaps_page.create_button.click()

    configmaps_page.fill_dialog_field("configmaps:field-name", unique)
    configmaps_page.confirm_dialog("configmaps:create-next")

    configmaps_page.dialog.get_by_role("button", name="添加数据").click()
    configmaps_page.fill_dialog_field("configmaps:data-key", "greeting")
    configmaps_page.fill_dialog_field("configmaps:data-value", "hello")
    configmaps_page.confirm_dialog("configmaps:data-save")

    configmaps_page.confirm_dialog("configmaps:create-submit")
    expect(configmaps_page.dialog).to_be_hidden()

    configmaps_page.wait_ready()
    # Read the token only after the page has an origin: `evaluate` throws on
    # about:blank, and the header is needed just for the cleanup below.
    token = configmaps_page.page.evaluate("() => localStorage.getItem('kubesphere-token')")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{ui_config.app}/api/v1/namespaces/default/configmaps/{unique}"
    try:
        assert unique in configmaps_page.row_names(), configmaps_page.row_names()
        screenshot(configmaps_page.page, "create-result")
    finally:
        configmaps_page.page.request.delete(url, headers=headers)
