from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GATEWAY_DETAIL_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-03 网关资源状态。"""

    ui = cluster_management_page
    api = ui.api
    status, body = api.request("GET", "/apis/gateway.kubesphere.io/v1alpha1/gateways")
    assert status == 200 and isinstance(body, dict), (status, body)
    items = body.get("items") or []
    assert items, "cluster gateway must exist"
    name = (items[0].get("metadata") or {}).get("name") or ""

    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gateways/{name}', wait_until="domcontentloaded")
    expect(ui.page.locator('[data-ai-id="gateway-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    section = ui.page.locator('[data-ai-id="gateway-detail:resource-status"]')
    expect(section).to_be_visible(timeout=30_000)
    expect(ui.page.locator('[data-ai-id="gateway-detail:resource-deployment"]')).to_be_visible(timeout=30_000)
    pods = ui.page.locator('[data-ai-id="gateway-detail:pods"]')
    expect(pods).to_be_visible(timeout=30_000)
    assert ui.page.locator('[data-ai-id^="gateway-detail:pod:"]').count() > 0
    screenshot(ui.page, "gateway-detail-resource-status")
