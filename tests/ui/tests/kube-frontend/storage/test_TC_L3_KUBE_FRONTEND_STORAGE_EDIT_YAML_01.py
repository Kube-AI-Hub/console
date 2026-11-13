from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_EDIT_YAML_01(storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01 存储：编辑 YAML 先弹加载框。"""

    ui = storage_page
    name = ui.unique("yaml")
    try:
        assert ui.create_pvc(name) in (200, 201), "could not create the test claim"

        ui.open("persistentvolumeclaims")
        ui.wait_ready("persistentvolumeclaims")
        ui.open_row_menu("persistentvolumeclaims", name)
        ui.click_row_action("编辑 YAML")

        # The frame comes first: the object still has to be fetched.
        expect(ui.loading_dialog).to_be_visible()
        expect(ui.dialog).to_be_visible()
        editor = ui.dialog.locator(".cm-content").first
        expect(editor).to_be_visible()
        expect(editor).to_contain_text(name)

        ui.dialog.get_by_role("button", name="取消").click()
        expect(ui.dialog).to_have_count(0)

        # Cancelling must not have touched the object.
        status, body = ui.api.request("GET", f"/api/v1/namespaces/default/persistentvolumeclaims/{name}")
        assert status == 200 and body["metadata"]["name"] == name
        screenshot(ui.page, "storage-edit-yaml")
    finally:
        ui.delete_pvc(name)
