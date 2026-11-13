from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLASSES = "/apis/storage.k8s.io/v1/storageclasses"
PVCS = "/api/v1/namespaces/default/persistentvolumeclaims"


def _create(ui, name: str, storage_class: str | None) -> None:
    spec: dict[str, object] = {
        "accessModes": ["ReadWriteOnce"],
        "resources": {"requests": {"storage": "1Gi"}},
    }
    if storage_class:
        spec["storageClassName"] = storage_class
    status, _ = ui.api.request(
        "POST",
        PVCS,
        {"apiVersion": "v1", "kind": "PersistentVolumeClaim", "metadata": {"name": name, "namespace": "default"}, "spec": spec},
    )
    assert status in (200, 201), status


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_EXPAND_01(storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-EXPAND-01 存储卷：扩容与按存储类门控。"""

    ui = storage_page
    assert ui.api is not None

    # Pick one class that allows expansion and one that does not, from the cluster
    # itself — the gate is only meaningful if both kinds exist here.
    status, body = ui.api.request("GET", CLASSES)
    if status != 200:
        pytest.skip("无法读取存储类，无法验证扩容门控")
    classes = body.get("items") or []
    expandable = next((c["metadata"]["name"] for c in classes if c.get("allowVolumeExpansion") is True), None)
    fixed = next((c["metadata"]["name"] for c in classes if c.get("allowVolumeExpansion") is not True), None)
    if not expandable or not fixed:
        pytest.skip("集群里没有同时具备可扩容与不可扩容的存储类")

    name_expandable = ui.unique("vx")
    name_fixed = ui.unique("vf")
    _create(ui, name_expandable, expandable)
    _create(ui, name_fixed, fixed)
    try:
        ui.open("persistentvolumeclaims")
        ui.wait_ready("persistentvolumeclaims")

        # A class without `allowVolumeExpansion` makes the apiserver reject the write,
        # so the control must not be offered at all.
        ui.ensure_row("persistentvolumeclaims", name_fixed)
        ui.row("persistentvolumeclaims", name_fixed).locator('button[aria-label="更多操作"]').click()
        actions_fixed = [t.strip() for t in ui.page.get_by_role("menuitem").all_inner_texts()]
        ui.page.keyboard.press("Escape")
        assert "扩容" not in actions_fixed, actions_fixed

        # The row action is gated on the storage-class list, a second request. Opening the
        # menu before it lands shows no 扩容 and reads as a missing control, so retry.
        actions_expandable: list[str] = []
        for _ in range(15):
            ui.ensure_row("persistentvolumeclaims", name_expandable)
            ui.row("persistentvolumeclaims", name_expandable).locator('button[aria-label="更多操作"]').click()
            actions_expandable = [t.strip() for t in ui.page.get_by_role("menuitem").all_inner_texts()]
            if "扩容" in actions_expandable:
                break
            ui.page.keyboard.press("Escape")
            ui.page.wait_for_timeout(2000)
        assert "扩容" in actions_expandable, actions_expandable
        ui.page.get_by_role("menuitem", name="扩容", exact=True).click()

        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()

        # Shrinking is rejected by every driver; the form explains instead.
        ui.page.locator("#ai-field-storage").fill("0.5Gi")
        dialog.get_by_role("button", name="确认").click()
        # Wait for the message itself rather than sleeping first; and confirm the refusal
        # by the object's size staying put, not by a sentence being somewhere on screen.
        expect(dialog).to_be_visible()
        expect(dialog).to_contain_text("不能小于", timeout=15_000)
        unchanged_status, unchanged = ui.api.request("GET", f"{PVCS}/{name_expandable}")
        assert unchanged_status == 200
        before_size = (((unchanged.get("spec") or {}).get("resources") or {}).get("requests") or {}).get("storage")
        assert before_size == "1Gi", before_size

        ui.page.locator("#ai-field-storage").fill("5Gi")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, claim = ui.api.request("GET", f"{PVCS}/{name_expandable}")
        assert status == 200
        requested = (((claim.get("spec") or {}).get("resources") or {}).get("requests") or {}).get("storage")
        assert requested == "5Gi", requested
        screenshot(ui.page, "storage-expand")
    finally:
        ui.delete_pvc(name_expandable)
        ui.delete_pvc(name_fixed)
