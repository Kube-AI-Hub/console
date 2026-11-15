from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_CREATE_02(kube_storage_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-CREATE-02 从快照创建存储卷。"""

    ui = kube_storage_page
    assert ui.api is not None
    status, snaps = ui.api.request("GET", f"/api/v1/namespaces/{NS}/volumesnapshots")
    ready = []
    if status == 200 and isinstance(snaps, dict):
        ready = [
            item
            for item in snaps.get("items") or []
            if (item.get("status") or {}).get("readyToUse") is True
        ]

    ui.page.goto(f"{ui.base_url}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/persistentvolumeclaims")
    surface = ui.page.locator('[data-ai-id="persistentvolumeclaims:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    ui.page.locator('[data-ai-id="persistentvolumeclaims:create"]').click()
    dialog = ui.page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=20_000)
    # 新建 branch: the class field is there.
    expect(ui.page.locator('[data-ai-id="storage-create:storage-class"]')).to_be_visible(timeout=20_000)

    ui.page.locator('[data-ai-id="storage-create:method"]').click()
    ui.page.get_by_role("option", name="从快照创建", exact=True).click()

    # 从快照 branch: the class field goes away, a snapshot field takes its place.
    expect(ui.page.locator('[data-ai-id="storage-create:storage-class"]')).to_have_count(0, timeout=20_000)
    if ready:
        expect(ui.page.locator('[data-ai-id="storage-create:snapshot"]')).to_be_visible(timeout=20_000)
    else:
        # The honest empty state: an empty dropdown would read as a defect.
        message = ui.page.locator('[data-ai-id="storage-create:no-snapshot"]')
        expect(message).to_be_visible(timeout=20_000)
        assert "快照" in message.inner_text()

    screenshot(ui.page, "storage-create-from-snapshot")
    ui.page.get_by_role("dialog").get_by_role("button", name="取消", exact=True).click()
