from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER = "host"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_CONFIG_LISTS_REFRESH_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01 集群配置与资源列表刷新。"""

    ui = cluster_management_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    pages = [
        ("cluster-serviceaccounts", f"{origin}/kube-frontend/clusters/{CLUSTER}/serviceaccounts"),
        ("cluster-networkpolicies", f"{origin}/kube-frontend/clusters/{CLUSTER}/networkpolicies"),
        ("components", f"{origin}/kube-frontend/clusters/{CLUSTER}/components"),
        ("ip-pools", f"{origin}/kube-frontend/clusters/{CLUSTER}/ippools"),
    ]
    for handle, url in pages:
        ui.page.goto(url)
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        # A disabled button is the fingerprint of a schema memo that never sees the query settle.
        expect(button).to_be_enabled(timeout=60_000)

    # Clicking refresh re-issues the component list request.
    ui.page.goto(f"{origin}/kube-frontend/clusters/{CLUSTER}/components")
    refresh = ui.page.locator('[data-ai-id="components:refresh"]')
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(
        lambda request: "components" in request.url and request.method == "GET", timeout=30_000
    ):
        refresh.click()
    screenshot(ui.page, "cluster-config-lists-refresh")
