from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_GATEWAYS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01 两视图与网关集合对账。"""
    ui = cluster_management_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/apis/gateway.kubesphere.io/v1alpha1/gateways")
    assert status == 200, body
    items = body.get("items") or []
    # The cluster gateway now lives in kubesphere-controls-system (the operator
    # installs the nginx release there); older operators used kubesphere-system.
    # Both namespaces are cluster-owned; a project gateway sits in its project.
    cluster_namespaces = {"kubesphere-system", "kubesphere-controls-system"}
    cluster_count = sum((item.get("metadata", {}) or {}).get("namespace") in cluster_namespaces for item in items)
    ui.page.goto(ui.url("gateways"))
    surface = ui.surface("cluster-gateways")
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(surface).to_have_attribute("data-ai-state", "ready" if cluster_count else "empty")
    expect(ui.rows("cluster-gateways")).to_have_count(cluster_count)
    ui.gateway_tab("project").click()
    expect(ui.page).to_have_url(ui.url("gateways") + "/project")
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(ui.rows("cluster-gateways")).to_have_count(len(items) - cluster_count)
    screenshot(ui.page, "cluster-gateways")
