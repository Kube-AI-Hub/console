from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DELETE_01(storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01 存储：删除存储卷。"""

    ui = storage_page
    name = ui.unique("del")
    assert ui.create_pvc(name) in (200, 201), "could not create the test claim"
    try:
        ui.open("persistentvolumeclaims")
        ui.wait_ready("persistentvolumeclaims")
        ui.open_row_menu("persistentvolumeclaims", name)
        ui.click_row_action("删除")

        expect(ui.dialog).to_be_visible()
        # The dialog is the typed-name kind: the confirm button stays disabled until
        # the object name is typed, so a bare click would wait forever.
        ui.page.locator('[data-ai-id="persistentvolumeclaims:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="persistentvolumeclaims:delete-confirm"]').click()
        expect(ui.dialog).to_have_count(0)

        ui.surface("persistentvolumeclaims").locator(f'[data-ai-row="{name}"]').wait_for(state="detached", timeout=20_000)
        status, _ = ui.api.request("GET", f"/api/v1/namespaces/default/persistentvolumeclaims/{name}")
        assert status == 404, status
        screenshot(ui.page, "storage-delete")
    finally:
        ui.delete_pvc(name)
