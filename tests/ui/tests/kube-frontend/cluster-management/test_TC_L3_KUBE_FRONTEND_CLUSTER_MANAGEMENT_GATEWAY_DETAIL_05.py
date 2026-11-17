from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GATEWAY_DETAIL_05(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-05 网关监控。"""

    ui = cluster_management_page
    api = ui.api
    status, body = api.request("GET", "/apis/gateway.kubesphere.io/v1alpha1/gateways")
    assert status == 200 and isinstance(body, dict), (status, body)
    items = body.get("items") or []
    assert items, "cluster gateway must exist"
    name = (items[0].get("metadata") or {}).get("name") or ""

    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gateways/{name}', wait_until="domcontentloaded")
    expect(ui.page.locator('[data-ai-id="gateway-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    section = ui.page.locator('[data-ai-id="gateway-detail:monitoring"]')
    expect(section).to_be_visible(timeout=30_000)
    unavailable = ui.page.locator('[data-ai-id="gateway-detail:monitor-unavailable"]')
    cpu = ui.page.locator('[data-ai-id="gateway-detail:monitor-cpu"]')
    for _ in range(30):
        if cpu.is_visible() or unavailable.is_visible():
            break
        ui.page.wait_for_timeout(500)
    if cpu.is_visible():
        expect(ui.page.locator('[data-ai-id="gateway-detail:monitor-memory"]')).to_be_visible()
        # B200 does not scrape nginx_ingress_controller_requests, so the note must be explicit.
        if ui.page.locator('[data-ai-id="gateway-detail:monitor-requests"]').count() == 0:
            expect(ui.page.locator('[data-ai-id="gateway-detail:monitor-ingress-unavailable"]')).to_be_visible()
    else:
        assert unavailable.is_visible()
    screenshot(ui.page, "gateway-detail-monitoring")
