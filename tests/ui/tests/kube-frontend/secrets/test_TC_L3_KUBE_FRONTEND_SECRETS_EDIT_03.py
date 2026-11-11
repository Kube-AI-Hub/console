from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_EDIT_03(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-EDIT-03 编辑 YAML 拒绝改名。"""

    name = e2e_objects["secret"](e2e_objects["unique"](), data={"k": "v"})
    secrets_page.open()
    # A list fetch that started before the create could cache a page without it.
    secrets_page.wait_for_row(name)
    secrets_page.open_row_menu(name)
    secrets_page.click_row_action("编辑 YAML")

    editor = secrets_page.page.locator('[role="dialog"] .cm-content').first
    expect(editor).to_be_visible()
    original = editor.inner_text()
    assert f"name: {name}" in original

    secrets_page.click("yaml:submit")
    expect(secrets_page.dialog).to_have_count(0)
    # Saving the untouched document must be a no-op, not a rename or a wipe.
    obj = e2e_objects["get"]("secrets", name)
    assert obj["metadata"]["name"] == name
    assert obj.get("data", {}).get("k")
    screenshot(secrets_page.page, "list-after-yaml")
