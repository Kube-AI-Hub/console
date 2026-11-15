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


def _wait_phase(api, name: str, phase: str, timeout_s: int = 90) -> str:
    deadline = time.time() + timeout_s
    current = ""
    while time.time() < deadline:
        status, body = api.request("GET", f"{PVCS}/{name}")
        if status == 200 and isinstance(body, dict):
            current = (body.get("status") or {}).get("phase") or ""
            if current == phase:
                return current
        time.sleep(3)
    return current


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_CLONE_01(kube_storage_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-CLONE-01 克隆存储卷。"""

    ui = kube_storage_page
    assert ui.api is not None

    status, classes = ui.api.request("GET", SCS)
    if status != 200 or not isinstance(classes, dict):
        pytest.skip("无法读取存储类型")
    cloneable = [
        item
        for item in classes.get("items") or []
        if ((item.get("metadata") or {}).get("annotations") or {}).get("storageclass.kubesphere.io/allow-clone") == "true"
    ]
    if not cloneable:
        pytest.skip("集群没有声明 allow-clone 的存储类型，无法验证克隆")
    class_name = cloneable[0]["metadata"]["name"]
    modes = (cloneable[0].get("metadata") or {}).get("annotations", {}).get(
        "storageclass.kubesphere.io/supported-access-modes"
    )
    import json as _json

    access_modes = _json.loads(modes) if modes else ["ReadWriteOnce"]
    name = f"tc-e2e-clone-src-{uuid.uuid4().hex[:8]}"
    clone_name = f"{name}-clone"

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
        assert _wait_phase(ui.api, name, "Bound") == "Bound", "源存储卷未能绑定，无法验证克隆"

        ui.page.goto(f"{ui.base_url}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/persistentvolumeclaims/{name}")
        surface = ui.page.locator('[data-ai-id="persistentvolumeclaims-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        clone_button = ui.page.locator('[data-ai-id="persistentvolumeclaims-detail:clone"]')
        expect(clone_button).to_be_visible(timeout=30_000)
        clone_button.click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="storage-clone:name"]')).to_have_value(clone_name)
        ui.page.locator('[data-ai-id="storage-clone:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)

        status, clone = ui.api.request("GET", f"{PVCS}/{clone_name}")
        assert status == 200, (status, clone)
        spec = clone.get("spec") or {}
        # The apiserver fills `apiGroup: null` for a core-group source, so compare the fields
        # that carry meaning rather than the whole map.
        data_source = spec.get("dataSource") or {}
        assert data_source.get("kind") == "PersistentVolumeClaim", spec
        assert data_source.get("name") == name, spec
        assert spec.get("storageClassName") == class_name, spec
        assert spec.get("accessModes") == access_modes, spec
        assert (spec.get("resources") or {}).get("requests", {}).get("storage") == "1Gi", spec
        # A clone returns to the list, where the new row is what the reader came for.
        expect(ui.page.locator('[data-ai-id="persistentvolumeclaims:surface"]').last).to_be_visible(timeout=30_000)
        screenshot(ui.page, "storage-clone")
    finally:
        ui.api.request("DELETE", f"{PVCS}/{clone_name}")
        ui.api.request("DELETE", f"{PVCS}/{name}")
