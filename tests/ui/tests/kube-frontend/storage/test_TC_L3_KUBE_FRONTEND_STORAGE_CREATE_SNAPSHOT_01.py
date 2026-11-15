from __future__ import annotations

import json as _json
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
def test_TC_L3_KUBE_FRONTEND_STORAGE_CREATE_SNAPSHOT_01(kube_storage_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-CREATE_SNAPSHOT-01 创建快照。"""

    ui = kube_storage_page
    assert ui.api is not None

    status, classes = ui.api.request("GET", SCS)
    if status != 200 or not isinstance(classes, dict):
        pytest.skip("无法读取存储类型")
    snapshottable = [
        item
        for item in classes.get("items") or []
        if ((item.get("metadata") or {}).get("annotations") or {}).get("storageclass.kubesphere.io/allow-snapshot") == "true"
    ]
    if not snapshottable:
        pytest.skip("集群没有声明 allow-snapshot 的存储类型，无法验证创建快照")
    target = snapshottable[0]
    class_name = target["metadata"]["name"]
    modes_annotation = (target.get("metadata") or {}).get("annotations", {}).get(
        "storageclass.kubesphere.io/supported-access-modes"
    )
    access_modes = _json.loads(modes_annotation) if modes_annotation else ["ReadWriteOnce"]
    name = f"tc-e2e-snap-src-{uuid.uuid4().hex[:8]}"

    try:
        body = {
            "apiVersion": "v1",
            "kind": "PersistentVolumeClaim",
            "metadata": {"name": name, "namespace": NS},
            "spec": {
                "storageClassName": class_name,
                "accessModes": access_modes,
                "resources": {"requests": {"storage": "1Gi"}},
            },
        }
        created, _ = ui.api.request("POST", PVCS, body)
        assert created in (200, 201), created
        deadline = time.time() + 90
        phase = ""
        while time.time() < deadline:
            status, current = ui.api.request("GET", f"{PVCS}/{name}")
            if status == 200 and isinstance(current, dict):
                phase = (current.get("status") or {}).get("phase") or ""
                if phase == "Bound":
                    break
            time.sleep(3)
        assert phase == "Bound", "源存储卷未能绑定，无法验证创建快照"

        status, vscs = ui.api.request("GET", "/apis/snapshot.storage.k8s.io/v1/volumesnapshotclasses")
        drivers = set()
        if status == 200 and isinstance(vscs, dict):
            drivers = {item.get("driver") for item in vscs.get("items") or []}
        status, claim = ui.api.request("GET", f"{PVCS}/{name}")
        annotations = ((claim or {}).get("metadata") or {}).get("annotations") or {}
        provisioner = annotations.get("volume.kubernetes.io/storage-provisioner") or annotations.get(
            "volume.beta.kubernetes.io/storage-provisioner"
        ) or ""

        ui.page.goto(f"{ui.base_url}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/persistentvolumeclaims/{name}")
        surface = ui.page.locator('[data-ai-id="persistentvolumeclaims-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        button = ui.page.locator('[data-ai-id="persistentvolumeclaims-detail:snapshot"]')
        expect(button).to_be_visible(timeout=30_000)
        button.click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)

        if provisioner and provisioner in drivers:
            expect(ui.page.locator('[data-ai-id="storage-snapshot:class"]')).to_be_visible(timeout=20_000)
            expect(ui.page.locator('[data-ai-id="storage-snapshot:submit"]')).to_be_enabled()
        else:
            # No class matches the driver: the dialog says why instead of showing an empty list.
            message = ui.page.locator('[data-ai-id="storage-snapshot:no-class"]')
            expect(message).to_be_visible(timeout=20_000)
            assert "快照类" in message.inner_text()
            expect(ui.page.locator('[data-ai-id="storage-snapshot:submit"]')).to_be_disabled()
        screenshot(ui.page, "storage-create-snapshot")
        ui.page.get_by_role("dialog").get_by_role("button", name="取消", exact=True).click()
    finally:
        ui.api.request("DELETE", f"{PVCS}/{name}")
