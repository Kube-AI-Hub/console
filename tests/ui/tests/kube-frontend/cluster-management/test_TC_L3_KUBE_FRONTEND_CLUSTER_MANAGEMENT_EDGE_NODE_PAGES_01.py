from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NODES = "/api/v1/nodes?labelSelector=node-role.kubernetes.io%2Fedge"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_EDGE_NODE_PAGES_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODE_PAGES-01 边缘节点列表与详情。"""

    ui = cluster_management_page
    assert ui.api is not None
    status, body = ui.api.request("GET", NODES)
    assert status == 200, (status, body)
    names = [item["metadata"]["name"] for item in body.get("items") or []]
    if not names:
        pytest.skip("集群没有边缘节点")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/edgenodes")
    surface = ui.page.locator('[data-ai-id="edgenodes:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    rows = surface.locator("[data-ai-row]")
    expect(rows).to_have_count(len(names), timeout=20_000)
    rendered = [row.get_attribute("data-ai-row") for row in rows.all()]
    assert rendered, rendered
    # The regular node list excludes these nodes; this list is the only place they appear.
    assert set(rendered) == set(names), (rendered, names)

    name = rendered[0]
    link = ui.page.locator(f'[data-ai-id="edgenodes:link:{name}"]')
    expect(link).to_be_visible(timeout=20_000)
    link.click()

    assert f"/edgenodes/{name}" in ui.page.url, ui.page.url
    detail = ui.page.locator('[data-ai-id="node-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(ui.page.get_by_role("tab", name="运行状态")).to_be_visible(timeout=20_000)

    screenshot(ui.page, "edge-nodes")
