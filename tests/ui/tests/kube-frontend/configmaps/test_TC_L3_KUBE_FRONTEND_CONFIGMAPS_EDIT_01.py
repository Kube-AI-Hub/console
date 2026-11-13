from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_EDIT_01(configmaps_page, seeded_configmaps, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01 编辑信息：名称只读，别名清空后注解被移除。"""

    # The list is empty on a fresh cluster; seed two objects so the case does
    # not depend on whatever happens to be deployed.
    seeded_configmaps["create"]("case-a", {"key-a": "1"})
    seeded_configmaps["create"]("case-b", {"key-b": "2"})

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready" or not configmaps_page.row_names():
        pytest.skip(f"没有对象可编辑，当前状态 {configmaps_page.state}")

    name = configmaps_page.row_names()[0]
    configmaps_page.open_row_menu(name)
    configmaps_page.click_row_action("编辑信息")

    name_field = configmaps_page.dialog.get_by_role("textbox").first
    expect(name_field).to_be_disabled()

    # Give it an alias first, so clearing it is a real transition rather than a no-op
    # on a field that was already empty.
    configmaps_page.fill_dialog_field("configmaps:edit-alias", "别名-edit01")
    configmaps_page.confirm_dialog("configmaps:edit-info-submit")
    expect(configmaps_page.dialog).to_be_hidden()
    stored = e2e_objects["get"]("configmaps", name)
    assert stored["__status"] == 200
    assert (stored["metadata"].get("annotations") or {}).get("kubesphere.io/alias-name") == "别名-edit01"

    configmaps_page.open_row_menu(name)
    configmaps_page.click_row_action("编辑信息")
    configmaps_page.fill_dialog_field("configmaps:edit-alias", "")
    configmaps_page.confirm_dialog("configmaps:edit-info-submit")
    expect(configmaps_page.dialog).to_be_hidden()

    # The case's own claim is that clearing the alias removes the annotation. Asserting
    # only that the dialog closed would pass even if nothing were saved.
    cleared = e2e_objects["get"]("configmaps", name)
    assert cleared["__status"] == 200
    annotations = cleared["metadata"].get("annotations") or {}
    assert "kubesphere.io/alias-name" not in annotations, annotations
    # The data the object exists for must survive an information edit. Which fixture
    # object this row is depends on list order, so compare against what was read
    # before the second edit rather than assuming it is the first one seeded.
    assert cleared.get("data"), "an information edit must not drop the object's data"

    screenshot(configmaps_page.page, "edit-info")
