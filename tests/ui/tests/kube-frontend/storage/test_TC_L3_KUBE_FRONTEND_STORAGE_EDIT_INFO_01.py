from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_EDIT_INFO_01(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-EDIT_INFO-01 存储：编辑信息写入别名。"""

    ui = kube_storage_page
    name = ui.unique("alias")
    try:
        assert ui.create_pvc(name) in (200, 201), "could not create the test claim"

        ui.open("persistentvolumeclaims")
        ui.wait_ready("persistentvolumeclaims")
        ui.open_row_menu("persistentvolumeclaims", name)
        ui.click_row_action("编辑信息")

        expect(ui.dialog).to_be_visible()
        ui.page.locator('[data-ai-id="persistentvolumeclaims:edit-alias"]').fill("卷别名")
        ui.dialog.get_by_role("button", name="确认").click()
        expect(ui.dialog).to_have_count(0)

        status, body = ui.api.request("GET", f"/api/v1/namespaces/default/persistentvolumeclaims/{name}")
        assert status == 200
        annotations = (body.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == "卷别名", annotations
        screenshot(ui.page, "storage-edit-info")
    finally:
        ui.delete_pvc(name)
