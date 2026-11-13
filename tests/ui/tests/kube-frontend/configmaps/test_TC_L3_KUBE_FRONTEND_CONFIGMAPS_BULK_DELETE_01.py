from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_BULK_DELETE_01(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-BULK_DELETE-01 配置字典：批量删除走完整条路径。"""

    ui = configmaps_page
    seed = seeded_configmaps
    # One shared prefix for both objects, so a single search makes exactly these two rows
    # visible. Creating them and expecting them on page 1 is not safe under `-n`: the list
    # is newest-first, and other workers create objects between ours.
    token = __import__('uuid').uuid4().hex[:6]
    names = [
        seed["create"](f"tc-e2e-bulk-{token}-a", {"k": "v"}),
        seed["create"](f"tc-e2e-bulk-{token}-b", {"k": "v"}),
    ]

    ui.open()
    ui.wait_ready()
    ui.search(f"tc-e2e-bulk-{token}")
    for name in names:
        ui.select_row(name)

    # `to_be_enabled` polls, so no sleep is needed for the selection to take effect.
    expect(ui.bulk_delete).to_be_enabled()
    ui.bulk_delete.click()

    dialog = ui.page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    # A batch is confirmed by its count. Asking for every name joined was friction
    # nobody could satisfy, which left the confirm button disabled for good — the
    # feature was unusable rather than merely awkward.
    ui.page.locator('[data-ai-id="configmaps:delete-input"]').fill(str(len(names)))
    confirm = ui.page.locator('[data-ai-id="configmaps:delete-confirm"]')
    expect(confirm).to_be_enabled()
    confirm.click()
    dialog.wait_for(state="detached", timeout=30_000)

    for name in names:
        expect(ui.surface.locator(f'[data-ai-row="{name}"]')).to_have_count(0, timeout=30_000)
    screenshot(ui.page, "configmaps-bulk-delete")
