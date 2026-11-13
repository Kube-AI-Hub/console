from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_EDIT_02(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02 编辑设置：重复键被拒绝，原有键值不丢失。"""

    # Seed an object with a known key rather than taking whichever row the list shows
    # first: the case needs a key to duplicate, and the first row may legitimately have
    # none, which made the case skip instead of test anything.
    name = seeded_configmaps["create"]("tc-e2e-dupkey", {"existing": "1"})

    configmaps_page.open()
    configmaps_page.wait_ready()
    configmaps_page.surface.locator(f'[data-ai-id="configmaps:search"]').fill(name)
    configmaps_page.page.wait_for_timeout(800)
    configmaps_page.wait_ready()

    configmaps_page.open_row_menu(name)
    configmaps_page.click_row_action("编辑设置")

    # The dialog opens first and loads the object's data into it; the rows are not
    # there on the first frame. Checking without waiting skipped this case for a
    # reason that had nothing to do with the behaviour it tests.
    existing = configmaps_page.dialog.locator("[data-ai-row]").first
    expect(existing).to_be_visible(timeout=20_000)

    key = existing.get_attribute("data-ai-row")
    configmaps_page.dialog.get_by_role("button", name="添加数据").click()
    configmaps_page.fill_dialog_field("configmaps:data-key", key or "")
    configmaps_page.confirm_dialog("configmaps:data-save")

    expect(configmaps_page.dialog.get_by_text("重复")).to_be_visible()
    screenshot(configmaps_page.page, "edit-settings-duplicate-key")
