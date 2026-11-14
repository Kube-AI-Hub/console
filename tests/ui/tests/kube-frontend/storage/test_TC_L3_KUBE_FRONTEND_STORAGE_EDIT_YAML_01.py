from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_EDIT_YAML_01(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01 编辑 YAML：先加载框再预填对象，取消不变。"""

    ui = kube_storage_page
    name = ui.unique("yaml")
    try:
        ui.create_pvc(name)
        ui.open("persistentvolumeclaims")
        ui.ensure_row("persistentvolumeclaims", name)

        status, before = ui.get_pvc(name)
        assert status == 200, (status, before)

        ui.open_row_menu("persistentvolumeclaims", name)
        ui.click_row_action("编辑 YAML")

        # Frame first, data second: the click must show the loading dialog before
        # the object has been fetched, then hand over to the editor.
        expect(ui.loading_dialog).to_be_visible(timeout=10_000)
        ui.wait_editor()
        expect(ui.loading_dialog).to_have_count(0)
        expect(ui.dialog).to_be_visible()

        document = ui.yaml_editor_text()
        assert "metadata:" in document, document
        # kapis strips the type metadata, so the document starts at `metadata`;
        # what the criterion requires is that it is *this* object, seeded from the
        # clicked row rather than blank or a template.
        assert f"name: {name}" in document, document
        assert "namespace: default" in document, document

        # Cancelling must not submit: no write, no rename, no wiped spec.
        ui.cancel_dialog()
        ui.wait_dialog_closed()

        status, after = ui.get_pvc(name)
        assert status == 200, (status, after)
        assert after["metadata"]["name"] == name
        assert after["metadata"]["resourceVersion"] == before["metadata"]["resourceVersion"], (before, after)
        screenshot(ui.page, "edit-yaml")
    finally:
        ui.delete_pvc(name)
