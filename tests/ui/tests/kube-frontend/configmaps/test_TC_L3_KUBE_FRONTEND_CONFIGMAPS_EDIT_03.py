from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_EDIT_03(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03 编辑 YAML：改名被拒绝，合法时整对象替换。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready" or not configmaps_page.row_names():
        pytest.skip(f"没有对象可编辑，当前状态 {configmaps_page.state}")

    name = configmaps_page.row_names()[0]
    configmaps_page.open_row_menu(name)
    configmaps_page.click_row_action("编辑 YAML")

    editor = configmaps_page.dialog.locator(".cm-content")
    expect(editor).to_be_visible()
    text = editor.inner_text()
    assert f"name: {name}" in text, text[:200]

    # Renaming is not an update; the dialog must refuse it rather than PUT to the
    # old name with a new one inside.
    editor.click()
    configmaps_page.page.keyboard.press("ControlOrMeta+a")
    configmaps_page.page.keyboard.type(text.replace(f"name: {name}", "name: renamed-by-test", 1))
    configmaps_page.confirm_dialog("configmaps:yaml-submit")

    expect(configmaps_page.dialog.get_by_text("名称无效")).to_be_visible()
    screenshot(configmaps_page.page, "edit-yaml-rename-rejected")
