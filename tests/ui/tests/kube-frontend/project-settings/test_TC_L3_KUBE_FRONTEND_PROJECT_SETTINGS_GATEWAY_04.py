from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER_GATEWAYS = "/kapis/gateway.kubesphere.io/v1alpha1/gateways"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_GATEWAY_04(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-04 项目网关页：集群网关卡片。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", CLUSTER_GATEWAYS)
    if status != 200:
        pytest.skip("无法读取集群网关")
    items = body.get("items") if isinstance(body, dict) else None
    # The cluster gateway is the installer's router; older installs also keep project
    # routers in the same namespace, so the name — not the namespace — identifies it.
    gateway = next(
        (item for item in (items or []) if item.get("metadata", {}).get("name") == "kubesphere-router-kubesphere-system"),
        None,
    )
    if gateway is None:
        pytest.skip("本集群没有集群网关（kubesphere-router-kubesphere-system），无法验证卡片")
    name = gateway["metadata"]["name"]

    ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/gateways")
    surface = ui.page.locator('[data-ai-id="gateway:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    card = ui.page.locator('[data-ai-id="gateway:cluster-gateway"]')
    expect(card).to_be_visible(timeout=30_000)
    assert ui.page.locator('[data-ai-id="gateway:cluster-name"]').inner_text().strip() == name
    # The address may be "-" when the Service does not exist yet; the field must be present.
    assert ui.page.locator('[data-ai-id="gateway:cluster-address"]').count() == 1
    assert ui.page.locator('[data-ai-id="gateway:cluster-type"]').count() == 1

    link = ui.page.locator('[data-ai-id="gateway:cluster-gateway-detail"]')
    href = link.get_attribute("href") or ""
    assert href.endswith(f"/clusters/{ui.cluster}/gateways/{name}"), f"应链到集群网关详情：{href}"
    assert "/projects/" not in href, f"集群网关是集群作用域，链接不该带项目段：{href}"
    screenshot(ui.page, "project-gateway-cluster-card")
