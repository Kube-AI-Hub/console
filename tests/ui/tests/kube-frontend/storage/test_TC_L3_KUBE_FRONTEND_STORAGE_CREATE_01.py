from __future__ import annotations

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
def test_TC_L3_KUBE_FRONTEND_STORAGE_CREATE_01(kube_storage_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-CREATE-01 创建存储卷（新建）。"""

    ui = kube_storage_page
    assert ui.api is not None

    status, classes = ui.api.request("GET", SCS)
    if status != 200 or not isinstance(classes, dict) or not (classes.get("items") or []):
        pytest.skip("集群没有存储类型，无法验证创建")
    items = classes["items"]
    default = next(
        (
            item
            for item in items
            if ((item.get("metadata") or {}).get("annotations") or {}).get("storageclass.kubernetes.io/is-default-class") == "true"
        ),
        items[0],
    )
    class_name = default["metadata"]["name"]
    name = f"tc-e2e-pvc-{uuid.uuid4().hex[:8]}"

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/persistentvolumeclaims")
        surface = ui.page.locator('[data-ai-id="persistentvolumeclaims:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="persistentvolumeclaims:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)

        # The default class is preselected: a claim that names no class is a different write.
        expect(ui.page.locator('[data-ai-id="storage-create:storage-class"]')).to_contain_text(class_name)
        ui.page.locator('[data-ai-id="storage-create:name"]').fill(name)
        ui.page.locator('[data-ai-id="storage-create:size"]').fill("1")

        # Out-of-range is refused locally, without a request.
        ui.page.locator('[data-ai-id="storage-create:size"]').fill("999999")
        ui.page.locator('[data-ai-id="storage-create:submit"]').click()
        expect(ui.page.locator('[data-ai-id="storage-create:error"]')).to_be_visible(timeout=10_000)
        assert ui.api.request("GET", f"{PVCS}/{name}")[0] == 404

        ui.page.locator('[data-ai-id="storage-create:size"]').fill("1")
        ui.page.locator('[data-ai-id="storage-create:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)

        status, body = ui.api.request("GET", f"{PVCS}/{name}")
        assert status == 200, (status, body)
        spec = body.get("spec") or {}
        assert spec.get("storageClassName") == class_name, spec
        assert spec.get("accessModes") == ["ReadWriteOnce"], spec
        assert (spec.get("resources") or {}).get("requests", {}).get("storage") == "1Gi", spec

        expect(ui.page.locator(f'[data-ai-row="{name}"]')).to_be_visible(timeout=30_000)
        screenshot(ui.page, "storage-create")
    finally:
        ui.api.request("DELETE", f"{PVCS}/{name}")
