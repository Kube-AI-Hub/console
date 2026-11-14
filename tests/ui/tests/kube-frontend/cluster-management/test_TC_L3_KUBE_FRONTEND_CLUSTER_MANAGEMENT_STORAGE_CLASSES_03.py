from __future__ import annotations

from collections import Counter

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

KAPIS = "/kapis/resources.kubesphere.io/v1alpha3"


def _storage_class(pvc: dict) -> str:
    return ((pvc.get("spec") or {}).get("storageClassName")) or ""


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_STORAGE_CLASSES_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-03 存储类型详情的关联存储卷。"""

    ui = cluster_management_page
    assert ui.api is not None, "api client required"

    status, classes = ui.api.request("GET", f"{KAPIS}/storageclasses?limit=-1")
    if status != 200 or not isinstance(classes, dict):
        pytest.skip("无法读取存储类型")
    class_items = classes.get("items") or []
    if not class_items:
        pytest.skip("集群没有存储类型")

    status, claims = ui.api.request("GET", f"{KAPIS}/persistentvolumeclaims?limit=-1", timeout=60)
    claim_items = (claims.get("items") or []) if status == 200 and isinstance(claims, dict) else []

    counts = Counter(_storage_class(claim) for claim in claim_items)
    class_names = [(item.get("metadata") or {}).get("name", "") for item in class_items]
    # Prefer a class that actually owns claims: that is the interesting case. When
    # none does, any class still proves the empty state renders.
    with_claims = [name for name in class_names if counts.get(name)]
    target = max(with_claims, key=lambda name: counts[name]) if with_claims else class_names[0]
    expected_claims = [claim for claim in claim_items if _storage_class(claim) == target]

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses/{target}")
    surface = ui.page.locator('[data-ai-id="sc-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    section = ui.page.locator('[data-ai-id="sc-detail:pvcs"]')
    expect(section).to_be_visible(timeout=30_000)
    # The section wrapper exists before its query resolves; wait for the table or the empty state
    # inside it, otherwise the headers are read from a placeholder.
    expect(section.locator("table").or_(section.locator('[data-ai-id="sc-detail:pvcs-empty"]')).first).to_be_visible(timeout=60_000)

    if expected_claims and section.locator("table").count() == 0:
        # PVCs are created and deleted by other cases while this one runs. Re-read the collection:
        # if the class really has no claims now, the empty state is the correct rendering.
        status, fresh = ui.api.request("GET", f"{KAPIS}/persistentvolumeclaims?limit=-1", timeout=60)
        fresh_items = (fresh.get("items") or []) if status == 200 and isinstance(fresh, dict) else []
        expected_claims = [claim for claim in fresh_items if _storage_class(claim) == target]

    if expected_claims:
        headers = [header.strip() for header in section.locator("thead th").all_inner_texts() if header.strip()]
        for expected in ("名称", "命名空间", "状态", "容量"):
            assert expected in headers, headers

        rows = section.locator("tbody tr[data-ai-row]")
        expect(rows).to_have_count(len(expected_claims), timeout=30_000)
        handles = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
        wanted = {((claim.get("metadata") or {}).get("namespace")) + "/" + ((claim.get("metadata") or {}).get("name")) for claim in expected_claims}
        assert set(handles) == wanted, handles

        first = rows.first
        namespace = ((expected_claims[0].get("metadata") or {}).get("namespace")) or ""
        name = ((expected_claims[0].get("metadata") or {}).get("name")) or ""
        assert namespace in first.inner_text(), first.inner_text()
        href = first.locator("a").first.get_attribute("href") or ""
        assert f"/projects/{namespace}/persistentvolumeclaims/{name}" in href, href
        assert href.startswith("/kube-frontend/") and "/clusters/" in href, href
    else:
        expect(section.locator('[data-ai-id="sc-detail:pvcs-empty"]')).to_be_visible(timeout=20_000)

    screenshot(ui.page, "sc-detail-claims")
