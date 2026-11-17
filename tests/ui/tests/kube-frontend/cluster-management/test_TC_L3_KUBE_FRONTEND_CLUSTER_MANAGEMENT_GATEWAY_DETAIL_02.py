from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GATEWAY_DETAIL_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GATEWAY_DETAIL-02 网关元数据。"""

    ui = cluster_management_page
    api = ui.api
    status, body = api.request("GET", "/apis/gateway.kubesphere.io/v1alpha1/gateways")
    assert status == 200 and isinstance(body, dict), (status, body)
    items = body.get("items") or []
    assert items, "cluster gateway must exist"
    gateway = items[0]
    name = (gateway.get("metadata") or {}).get("name") or ""
    annotations = (gateway.get("metadata") or {}).get("annotations") or {}

    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gateways/{name}', wait_until="domcontentloaded")
    surface = ui.page.locator('[data-ai-id="gateway-detail:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    metadata = ui.page.locator('[data-ai-id="gateway-detail:metadata"]')
    expect(metadata).to_be_visible(timeout=30_000)
    expect(metadata).to_contain_text("ResourceVersion")
    if annotations:
        key = next(iter(annotations))
        expect(ui.page.locator('[data-ai-id="gateway-detail:annotations"]')).to_contain_text(key)
    else:
        expect(ui.page.locator('[data-ai-id="gateway-detail:annotations"]')).to_contain_text("暂无元数据")
    screenshot(ui.page, "gateway-detail-metadata")
