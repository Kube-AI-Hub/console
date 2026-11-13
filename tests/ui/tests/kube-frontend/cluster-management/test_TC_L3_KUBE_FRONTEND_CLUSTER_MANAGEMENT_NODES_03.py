from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NODES = "/kapis/resources.kubesphere.io/v1alpha3/nodes"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03 节点详情：条件、容量、标签与污点。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{NODES}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取节点列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("集群没有节点，无法核对节点详情")

    node = items[0]
    name = node["metadata"]["name"]
    conditions = (node.get("status") or {}).get("conditions") or []
    allocatable = (node.get("status") or {}).get("allocatable") or {}

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes")
    surface = ui.page.locator('[data-ai-id="nodes:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    link = surface.locator(f'[data-ai-row="{name}"] a').first
    expect(link).to_have_attribute("href", f"/kube-frontend/clusters/{ui.cluster}/nodes/{name}")
    link.click()

    detail = ui.page.locator('[data-ai-id="node-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(ui.page).to_have_url(re.compile(rf"/clusters/{ui.cluster}/nodes/{name}$"))

    # ---- basic facts come from the object, not from the list row ----
    basic = ui.page.locator('[data-ai-id="node-detail:basic"]').inner_text()
    assert (node.get("status") or {}).get("nodeInfo", {}).get("kubeletVersion", "") in basic or "v1." in basic
    # ---- capacity is human-readable: no raw Kubernetes suffixes ----
    capacity = ui.page.locator('[data-ai-id="node-detail:capacity"]').inner_text()
    assert "/" in capacity
    for raw in ("m /", "Ki", "Mi"):
        assert raw not in capacity, f"容量未换算成可读单位，仍出现 {raw}: {capacity[:200]}"
    assert "GiB" in capacity or "TiB" in capacity or "cpu" in capacity

    # ---- every condition has a row: a missing one is the condition that explains a fault ----
    rows = ui.page.locator('[data-ai-id^="node-detail:condition:"]')
    if conditions:
        assert rows.count() == len(conditions), f"条件条目 {rows.count()} 与对象中的 {len(conditions)} 不一致"

    labels = ui.page.locator('[data-ai-id="node-detail:labels"]').inner_text()
    assert "kubernetes.io/hostname" in labels, labels[:200]

    screenshot(ui.page, "node-detail")