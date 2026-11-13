from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PVS = "/api/v1/persistentvolumes"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_PERSISTENT_VOLUMES_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02 持久卷详情。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", PVS)
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取持久卷列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("集群没有持久卷")

    volume = items[0]
    name = volume["metadata"]["name"]
    spec = volume.get("spec") or {}
    claim_ref = spec.get("claimRef") or {}
    reclaim = spec.get("persistentVolumeReclaimPolicy") or "Retain"

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/persistentvolumes")
    surface = ui.page.locator('[data-ai-id="persistentvolumes:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    link = surface.locator(f'[data-ai-row="{name}"] a').first
    expect(link).to_have_attribute("href", f"/kube-frontend/clusters/{ui.cluster}/persistentvolumes/{name}")
    link.click()

    detail = ui.page.locator('[data-ai-id="pv-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(ui.page).to_have_url(re.compile(rf"/clusters/{ui.cluster}/persistentvolumes/{name}$"))

    basic = ui.page.locator('[data-ai-id="pv-detail:basic"]').inner_text()
    # Reclaim policy is the field that decides whether deleting the claim destroys data, so
    # it is the one that must never be guessed.
    assert reclaim in basic, f"回收策略应为 {reclaim}: {basic[:200]}"
    assert str((spec.get("capacity") or {}).get("storage", ""))[:2] in basic or "TiB" in basic or "GiB" in basic

    claim = ui.page.locator('[data-ai-id="pv-detail:claim"]').inner_text()
    if claim_ref.get("name"):
        assert str(claim_ref["name"]) in claim, claim
        if claim_ref.get("namespace"):
            assert str(claim_ref["namespace"]) in claim, claim
    else:
        assert "尚未" in claim, claim

    screenshot(ui.page, "persistent-volume-detail")
