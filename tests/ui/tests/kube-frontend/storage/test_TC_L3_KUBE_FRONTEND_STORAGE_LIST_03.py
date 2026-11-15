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
SCS = "/apis/storage.k8s.io/v1/storageclasses"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_LIST_03(kube_storage_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-LIST-03 存储卷列表的持久卷列。"""

    ui = kube_storage_page
    assert ui.api is not None
    name = f"tc-e2e-pv-col-{uuid.uuid4().hex[:8]}"

    try:
        # Seed a claim that binds quickly, so the column has a value to show: the project may have
        # no bound claim of its own, and asserting the header alone would not prove the link.
        status, classes = ui.api.request("GET", SCS)
        if status != 200 or not isinstance(classes, dict):
            pytest.skip("无法读取存储类型")
        fast = [item for item in classes.get("items") or [] if item.get("provisioner") == "csi.juicefs.com"]
        if not fast:
            pytest.skip("没有可快速绑定的存储类型，无法核对持久卷列取值")
        created, _ = ui.api.request(
            "POST",
            PVCS,
            {
                "apiVersion": "v1",
                "kind": "PersistentVolumeClaim",
                "metadata": {"name": name, "namespace": NS},
                "spec": {
                    "storageClassName": fast[0]["metadata"]["name"],
                    "accessModes": ["ReadWriteMany"],
                    "resources": {"requests": {"storage": "1Gi"}},
                },
            },
        )
        assert created in (200, 201), created
        deadline = time.time() + 90
        volume = ""
        while time.time() < deadline:
            status, obj = ui.api.request("GET", f"{PVCS}/{name}")
            if status == 200 and isinstance(obj, dict) and (obj.get("status") or {}).get("phase") == "Bound":
                volume = (obj.get("spec") or {}).get("volumeName") or ""
                break
            time.sleep(3)
        assert volume, "存储卷未能绑定，无法核对持久卷列"

        ui.page.set_viewport_size({"width": 1600, "height": 1000})
        ui.page.goto(f"{ui.base_url}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/persistentvolumeclaims")
        surface = ui.page.locator('[data-ai-id="persistentvolumeclaims:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        headers = [header.strip() for header in surface.locator("thead th").all_inner_texts() if header.strip()]
        assert "持久卷" in headers, headers

        link = ui.page.locator(f'[data-ai-id="persistentvolumeclaims:volume:{volume}"]')
        expect(link).to_be_visible(timeout=30_000)
        assert link.inner_text().strip() == volume
        href = link.get_attribute("href") or ""
        assert f"/clusters/{CLUSTER}/persistentvolumes/{volume}" in href, href
        expect(ui.page.locator(f'[data-ai-row="{name}"]')).to_have_count(1)
        screenshot(ui.page, "storage-list-pv-column")
    finally:
        ui.api.request("DELETE", f"{PVCS}/{name}")
