from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"
PVCS = f"/api/v1/namespaces/{NS}/persistentvolumeclaims"
KAPIS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/%s/persistentvolumeclaims" % NS


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DETAIL_TABS_01(kube_storage_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01 存储详情的元数据与事件页签。"""

    ui = kube_storage_page
    assert ui.api is not None
    name = f"tc-e2e-pvc-tabs-{uuid.uuid4().hex[:8]}"

    try:
        body = {
            "apiVersion": "v1",
            "kind": "PersistentVolumeClaim",
            "metadata": {
                "name": name,
                "namespace": NS,
                "labels": {"app": "tc-e2e", "purpose": "tabs"},
                "annotations": {"tc-e2e/note": "metadata tab", "kubesphere.io/alias-name": "页签探针"},
            },
            "spec": {
                "accessModes": ["ReadWriteOnce"],
                "resources": {"requests": {"storage": "1Gi"}},
            },
        }
        created, _ = ui.api.request("POST", PVCS, body)
        assert created in (200, 201), created
        ui.page.goto(f"{ui.base_url}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/persistentvolumeclaims/{name}")
        surface = ui.page.locator('[data-ai-id="persistentvolumeclaims-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        # Four tabs, in the old console's order.
        expect(ui.page.get_by_role("tab")).to_have_count(4)
        expect(ui.page.locator('[data-ai-id="storage-detail:tab:metadata"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="storage-detail:tab:events"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="storage-detail:tab:snapshots"]')).to_be_visible()

        ui.page.locator('[data-ai-id="storage-detail:tab:metadata"]').click()
        expect(ui.page.locator('[data-ai-id="storage-detail:labels"]')).to_be_visible(timeout=20_000)
        # Read through the same endpoint the page reads (kapis), not the core API: kapis enriches
        # claims with computed annotations (kubesphere.io/in-use, allow-snapshot), so a core-API
        # read is not the set of rows a correct page shows.
        status, current = ui.api.request("GET", f"{KAPIS}/{name}")
        assert status == 200, (status, current)
        labels = ((current or {}).get("metadata") or {}).get("labels") or {}
        annotations = ((current or {}).get("metadata") or {}).get("annotations") or {}
        expect(ui.page.locator('[data-ai-id="storage-detail:labels"] tbody tr')).to_have_count(len(labels))
        # Annotations keep changing after creation (binding stamps a provisioner annotation), so the
        # page may legitimately hold a slightly older snapshot than this read. What must hold is
        # that every rendered row is a real annotation and that the ones we set are shown.
        rows = ui.page.locator('[data-ai-id="storage-detail:annotations"] tbody tr')
        expect(rows.first).to_be_visible(timeout=20_000)
        rendered = [row.get_attribute("data-ai-row") for row in rows.all()]
        assert len(rendered) == len(set(rendered)), rendered
        assert set(rendered) <= set(annotations), (rendered, sorted(annotations))
        assert {"tc-e2e/note", "kubesphere.io/alias-name"} <= set(rendered), rendered
        assert "tc-e2e" in ui.page.locator('[data-ai-id="storage-detail:labels"]').inner_text()
        # Read-only: editing goes through 编辑信息 / 编辑 YAML.
        assert ui.page.locator('[data-ai-id="storage-detail:labels"] input').count() == 0

        ui.page.locator('[data-ai-id="storage-detail:tab:events"]').click()
        table = ui.page.locator('[data-ai-id="storage-detail:events"]')
        empty = ui.page.locator('[data-ai-id="storage-detail:events-empty"]')
        expect(table.or_(empty)).to_be_visible(timeout=30_000)
        if table.count():
            assert table.locator("tbody tr").count() >= 1
        screenshot(ui.page, "storage-detail-tabs")
    finally:
        ui.api.request("DELETE", f"{PVCS}/{name}")
