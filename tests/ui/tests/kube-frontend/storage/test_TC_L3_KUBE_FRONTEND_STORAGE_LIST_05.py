from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"
PVCS = f"/api/v1/namespaces/{NS}/persistentvolumeclaims"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_LIST_05(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-LIST-05 存储卷与快照列表的刷新与空态出口。"""

    ui = kube_storage_page
    assert ui.api is not None
    name = f"tc-e2e-refresh-pvc-{uuid.uuid4().hex[:8]}"

    try:
        ui.page.goto(f"{ui.base}/persistentvolumeclaims")
        surface = ui.page.locator('[data-ai-id="persistentvolumeclaims:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        refresh = ui.page.locator('[data-ai-id="persistentvolumeclaims:refresh"]')
        expect(refresh).to_be_visible(timeout=20_000)
        expect(ui.page.locator(f'[data-ai-row="{name}"]')).to_have_count(0)

        # Created behind the page's back: only a refetch can surface it.
        status, body = ui.api.request(
            "POST",
            PVCS,
            {
                "apiVersion": "v1",
                "kind": "PersistentVolumeClaim",
                "metadata": {"name": name, "namespace": NS},
                "spec": {
                    "storageClassName": "openebs-hostpath",
                    "accessModes": ["ReadWriteOnce"],
                    "resources": {"requests": {"storage": "1Gi"}},
                },
            },
        )
        assert status in (200, 201), (status, body)
        refresh.click()
        expect(ui.page.locator(f'[data-ai-row="{name}"]')).to_be_visible(timeout=30_000)

        # The empty state offers a way out.
        search = ui.page.locator('[data-ai-id="persistentvolumeclaims:search"]').last
        search.fill("zzz-no-such-claim")
        expect(ui.page.locator("[data-ai-row]")).to_have_count(0, timeout=30_000)
        clear = ui.page.get_by_role("button", name="清空搜索与筛选")
        expect(clear).to_be_visible(timeout=20_000)
        clear.click()
        expect(ui.page.locator("[data-ai-row]").first).to_be_visible(timeout=30_000)
        screenshot(ui.page, "storage-list-refresh")

        # The snapshot list is the same component with another kind, and must carry the control too.
        ui.page.goto(f"{ui.base}/volumesnapshots")
        expect(ui.page.locator('[data-ai-id="volumesnapshots:refresh"]')).to_be_visible(timeout=60_000)
        ui.page.locator('[data-ai-id="volumesnapshots:search"]').last.fill("zzz-no-such-snapshot")
        expect(ui.page.get_by_role("button", name="清空搜索与筛选")).to_be_visible(timeout=30_000)
    finally:
        ui.api.request("DELETE", f"{PVCS}/{name}")
