from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_STORAGE_01(kube_storage_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-STORAGE-01 存储：页签切换不刷新文档，编辑 YAML 先加载后编辑器。"""

    ui = kube_storage_page
    name = ui.unique("page")
    try:
        ui.create_pvc(name)
        ui.open("persistentvolumeclaims")
        assert ui.state("persistentvolumeclaims") in {"ready", "empty"}, ui.state("persistentvolumeclaims")
        ui.ensure_row("persistentvolumeclaims", name)

        expect(ui.tabs_nav).to_be_visible()
        expect(ui.workspace_bar).to_be_visible()
        expect(ui.current_project).to_contain_text("default")
        assert ui.active_tab_key() == "persistentvolumeclaims", ui.page.url

        # AC-02: the click opens a loading frame at once, and the editor replaces it
        # only once the full object has arrived. Cancelling must not write anything.
        _, before = ui.get_pvc(name)
        ui.open_row_menu("persistentvolumeclaims", name)
        ui.click_row_action("编辑 YAML")
        expect(ui.loading_dialog).to_be_visible(timeout=10_000)
        ui.wait_editor()
        expect(ui.loading_dialog).to_have_count(0)
        document = ui.yaml_editor_text()
        assert "metadata:" in document, document
        assert f"name: {name}" in document, document
        assert "namespace: default" in document, document

        ui.cancel_dialog()
        ui.wait_dialog_closed()
        status, after = ui.get_pvc(name)
        assert status == 200, (status, after)
        assert after["metadata"]["resourceVersion"] == before["metadata"]["resourceVersion"], (before, after)

        # The initial `goto` is a document request by definition; what the area
        # promises is that *switching tabs* never makes another one.
        documents: list[str] = []
        ui.page.on(
            "request",
            lambda request: documents.append(request.url) if request.resource_type == "document" else None,
        )

        ui.switch_tab("volumesnapshots")
        assert ui.active_tab_key() == "volumesnapshots", ui.page.url
        assert ui.active_tab_label() == "存储卷快照"
        expect(ui.current_project).to_contain_text("default")
        # The empty snapshot page behaves like every other area's empty list —
        # no header over "there is nothing here".
        expect(ui.surface("volumesnapshots")).to_have_attribute("data-ai-state", "empty")
        assert ui.surface("volumesnapshots").locator("thead").count() == 0

        ui.switch_tab("persistentvolumeclaims")
        assert ui.active_tab_key() == "persistentvolumeclaims", ui.page.url
        assert ui.active_tab_label() == "存储卷"
        expect(ui.current_project).to_contain_text("default")
        expect(ui.row("persistentvolumeclaims", name)).to_be_visible()

        assert ui.page.url.endswith("/projects/default/persistentvolumeclaims"), ui.page.url
        assert documents == [], f"tab switches issued document requests: {documents}"
        screenshot(ui.page, "tabs")
    finally:
        ui.delete_pvc(name)
