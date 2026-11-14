from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

KAPIS = "/kapis/resources.kubesphere.io/v1alpha3"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DETAIL_SNAPSHOTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_SNAPSHOTS-01 存储卷详情的快照页签（只读）。"""

    ui = cluster_management_page
    assert ui.api is not None, "api client required"

    status, claims = ui.api.request("GET", f"{KAPIS}/persistentvolumeclaims?limit=-1", timeout=60)
    if status != 200 or not isinstance(claims, dict):
        pytest.skip("无法读取存储卷")
    claim_items = claims.get("items") or []
    if not claim_items:
        pytest.skip("集群没有存储卷")
    claim = claim_items[0]
    metadata = claim.get("metadata") or {}
    namespace = metadata.get("namespace") or ""
    name = metadata.get("name") or ""
    assert namespace and name

    status, namespaces = ui.api.request("GET", f"{KAPIS}/namespaces?limit=-1")
    workspace = "public"
    if status == 200 and isinstance(namespaces, dict):
        for entry in namespaces.get("items") or []:
            entry_metadata = entry.get("metadata") or {}
            if entry_metadata.get("name") == namespace:
                workspace = ((entry_metadata.get("labels") or {}).get("kubesphere.io/workspace")) or "public"
                break

    # The snapshots of this claim, filtered by the source field the page uses.
    status, snapshots = ui.api.request("GET", f"{KAPIS}/namespaces/{namespace}/volumesnapshots?limit=-1", timeout=60)
    snapshot_items = (snapshots.get("items") or []) if status == 200 and isinstance(snapshots, dict) else []
    expected = [
        item
        for item in snapshot_items
        if ((item.get("spec") or {}).get("source") or {}).get("persistentVolumeClaimName") == name
    ]

    ui.page.goto(
        f"{ui.base_url}/kube-frontend/{workspace}/clusters/{ui.cluster}/projects/{namespace}/persistentvolumeclaims/{name}"
    )
    surface = ui.page.locator('[data-ai-id="persistentvolumeclaims-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    expect(ui.page.locator('[data-ai-id="storage-detail:tab:attributes"]')).to_be_visible(timeout=20_000)
    snapshot_tab = ui.page.locator('[data-ai-id="storage-detail:tab:snapshots"]')
    expect(snapshot_tab).to_be_visible()
    snapshot_tab.click()

    panel = ui.page.locator('[data-ai-id="storage-detail:snapshots"]')
    expect(panel).to_be_visible(timeout=20_000)

    if expected:
        headers = [header.strip() for header in panel.locator("thead th").all_inner_texts() if header.strip()]
        for expected_header in ("名称", "状态", "大小", "创建时间"):
            assert expected_header in headers, headers
        rows = panel.locator("tbody tr[data-ai-row]")
        expect(rows).to_have_count(len(expected), timeout=30_000)
        handles = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
        assert set(handles) == {((item.get("metadata") or {}).get("name")) for item in expected}, handles
        for entry in expected:
            snapshot_name = (entry.get("metadata") or {}).get("name") or ""
            expect(panel.locator(f'[data-ai-id="storage-detail:snapshot:{snapshot_name}"]')).to_be_visible()
    else:
        # B200 installs the CRD but has no snapshot objects: the empty state is the
        # expected outcome, and it must be explicit rather than a blank panel.
        empty = panel.locator('[data-ai-id="storage-detail:snapshots-empty"]')
        expect(empty).to_be_visible(timeout=20_000)
        assert "还没有快照" in empty.inner_text()

    # Read-only: the tab offers no create/delete action.
    action_labels = panel.locator("button").all_inner_texts()
    for forbidden in ("创建", "删除"):
        assert not any(forbidden in label for label in action_labels), (forbidden, action_labels)

    screenshot(ui.page, "pvc-detail-snapshots")
