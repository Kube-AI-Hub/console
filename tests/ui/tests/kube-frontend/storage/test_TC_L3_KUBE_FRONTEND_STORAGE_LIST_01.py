from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_LIST_01(storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-LIST-01 存储：列表五列与名称链接。"""

    ui = storage_page
    name = ui.unique("list")
    try:
        assert ui.create_pvc(name) in (200, 201), "could not create the test claim"

        ui.open("persistentvolumeclaims")
        ui.wait_ready("persistentvolumeclaims")
        ui.ensure_row("persistentvolumeclaims", name)

        headers = ui.headers("persistentvolumeclaims")
        required = ["名称", "状态", "容量", "访问模式", "创建时间"]
        positions = [headers.index(label) for label in required if label in headers]
        assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
        assert positions == sorted(positions), f"columns out of order: {headers}"

        link = ui.page.locator(f'[data-ai-id="persistentvolumeclaims:open:{name}"]').first
        expect(link).to_be_visible()
        assert link.get_attribute("href").endswith(f"/persistentvolumeclaims/{name}")
        screenshot(ui.page, "storage-list")
    finally:
        ui.delete_pvc(name)
