from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_EDIT_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-EDIT-01 编辑信息不改角色。"""

    name = e2e_objects["service_account"](e2e_objects["unique"](), role="viewer")
    serviceaccounts_page.open()
    serviceaccounts_page.open_row_menu(name)
    serviceaccounts_page.click_row_action("编辑")
    expect(serviceaccounts_page.dialog).to_be_visible()
    serviceaccounts_page.fill("serviceaccounts:edit-alias", "别名-SA")
    serviceaccounts_page.click("serviceaccounts:edit-info-submit")
    expect(serviceaccounts_page.dialog).to_have_count(0)

    obj = e2e_objects["get"]("serviceaccounts", name)
    annotations = obj["metadata"]["annotations"]
    assert annotations["kubesphere.io/alias-name"] == "别名-SA"
    assert annotations["iam.kubesphere.io/role"] == "viewer"

    # YAML refuses a rename.
    serviceaccounts_page.open_row_menu(name)
    serviceaccounts_page.click_row_action("编辑 YAML")
    editor = serviceaccounts_page.page.locator('[role="dialog"] .cm-content').first
    expect(editor).to_be_visible()
    serviceaccounts_page.click("yaml:submit")
    expect(serviceaccounts_page.dialog).to_have_count(0)
    assert e2e_objects["get"]("serviceaccounts", name)["metadata"]["name"] == name
    screenshot(serviceaccounts_page.page, "list-after-edit")
