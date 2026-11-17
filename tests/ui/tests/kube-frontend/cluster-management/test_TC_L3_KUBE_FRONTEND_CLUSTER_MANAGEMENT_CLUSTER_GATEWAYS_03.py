from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER_GATEWAY_ROW = "kubesphere-controls-system/kubesphere-router-kubesphere-system"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_GATEWAYS_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03 集群网关编辑。"""

    ui = cluster_management_page
    api = ui.api
    status, body = api.request("GET", "/apis/gateway.kubesphere.io/v1alpha1/gateways")
    assert status == 200 and isinstance(body, dict), (status, body)
    names = [(i.get("metadata") or {}).get("namespace", "") + "/" + ((i.get("metadata") or {}).get("name", "")) for i in body.get("items") or []]
    row_key = CLUSTER_GATEWAY_ROW if CLUSTER_GATEWAY_ROW in names else (names[0] if names else "")
    assert row_key, names

    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gateways/cluster', wait_until="domcontentloaded")
    surface = ui.page.locator('[data-ai-id="cluster-gateways:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    row = ui.page.locator(f'[data-ai-row="{row_key}"]')
    expect(row).to_be_visible(timeout=60_000)
    row.get_by_role("button", name="更多操作").click()
    ui.page.get_by_role("menuitem", name="编辑").click()
    expect(ui.page.locator('[data-ai-id="gateway:edit:save"]')).to_be_visible(timeout=20_000)
    screenshot(ui.page, "cluster-gateway-edit-dialog")
    ui.page.locator('[data-ai-id="gateway:edit:save"]').click()
    expect(ui.page.locator('[data-ai-id="gateway:edit:save"]')).to_have_count(0, timeout=60_000)
    expect(ui.page.locator('[data-ai-id="gateway:edit:error"]')).to_have_count(0)

    status, body = api.request("GET", "/apis/gateway.kubesphere.io/v1alpha1/gateways")
    assert status == 200
    assert any(
        (i.get("metadata") or {}).get("namespace", "") + "/" + ((i.get("metadata") or {}).get("name", "")) == row_key
        for i in body.get("items") or []
    )
