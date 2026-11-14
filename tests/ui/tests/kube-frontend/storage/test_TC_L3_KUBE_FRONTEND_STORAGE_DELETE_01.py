from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DELETE_01(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01 删除存储卷：输入名称确认后行消失。"""

    ui = kube_storage_page
    name = ui.unique("delete")
    try:
        ui.create_pvc(name)
        ui.open("persistentvolumeclaims")
        ui.ensure_row("persistentvolumeclaims", name)

        ui.open_row_menu("persistentvolumeclaims", name)
        ui.click_row_action("删除")
        expect(ui.dialog).to_be_visible()

        confirm = ui.page.locator('[data-ai-id="persistentvolumeclaims:delete-confirm"]')
        expect(confirm).to_be_disabled()
        ui.fill("persistentvolumeclaims:delete-input", name[:-1])
        expect(confirm).to_be_disabled()
        ui.fill("persistentvolumeclaims:delete-input", name)
        expect(confirm).to_be_enabled()
        confirm.click()

        expect(ui.dialog).to_have_count(0)
        expect(ui.row("persistentvolumeclaims", name)).to_have_count(0, timeout=15_000)
        status, body = ui.get_pvc(name)
        assert status == 404, (status, body)
        screenshot(ui.page, "list-after-delete")
    finally:
        # Defensive: a 404 here is the expected outcome when the UI deleted it.
        ui.delete_pvc(name)
