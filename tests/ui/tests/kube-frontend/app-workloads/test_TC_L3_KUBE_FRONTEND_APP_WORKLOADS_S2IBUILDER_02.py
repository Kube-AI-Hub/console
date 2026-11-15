from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_02(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02 镜像构建器行操作：编辑信息与删除（回读与清理）。"""

    ui = image_builder_page
    name = ui.unique("row")
    try:
        assert ui.create_builder(name, image_name="tc-e2e/list-actions") == 201
        ui.open_list()
        ui.ensure_row(name)

        # The row menu offers exactly the two old actions, in the old order.
        ui.open_row_menu(name)
        items = [text.strip() for text in ui.page.get_by_role("menuitem").all_inner_texts() if text.strip()]
        ui.page.keyboard.press("Escape")
        ui.page.wait_for_timeout(200)
        assert items == ["编辑信息", "删除"], items

        ui.open_row_menu(name)
        ui.choose_row_action("编辑信息")
        expect(ui.dialog).to_be_visible()
        ui.fill("image-builder:edit-alias", "列表别名")
        ui.fill("image-builder:edit-description", "列表描述")
        ui.click("image-builder:edit-info-submit")
        ui.wait_dialog_closed()

        status, body = ui.get_builder(name)
        assert status == 200, (status, body)
        annotations = (body.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == "列表别名", annotations
        assert annotations.get("kubesphere.io/description") == "列表描述", annotations
        # Untouched annotations survive the merge patch.
        assert annotations.get("languageType") == "java", annotations

        ui.open_row_menu(name)
        ui.choose_row_action("删除")
        expect(ui.dialog).to_be_visible()
        ui.fill("image-builder:delete-input", name)
        ui.click("image-builder:delete-confirm")
        ui.wait_dialog_closed()
        expect(ui.row(name)).to_have_count(0, timeout=20_000)

        status, _ = ui.get_builder(name)
        assert status == 404, status
        screenshot(ui.page, "image-builder-row-actions")
    finally:
        ui.delete_builder(name)
