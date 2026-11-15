from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_REMAINING_LISTS_REFRESH_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01 其余独立列表页刷新。"""

    ui = cluster_management_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    pages = [
        ("devops", f"{origin}/kube-frontend/clusters/{CLUSTER}/devops"),
        ("cluster-juicefs", f"{origin}/kube-frontend/clusters/{CLUSTER}/juicefs-storage"),
        ("custom-monitoring", f"{origin}/kube-frontend/clusters/{CLUSTER}/custom-monitoring"),
        ("grayrelease", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/grayrelease"),
        ("image-builder", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/s2ibuilder"),
        ("serviceaccounts", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/serviceaccounts"),
    ]
    for handle, url in pages:
        ui.page.goto(url)
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        # A disabled button is the fingerprint of a schema memo that never sees the query settle.
        expect(button).to_be_enabled(timeout=60_000)

    # Clicking refresh re-issues the image builder list request.
    ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/s2ibuilder")
    refresh = ui.page.locator('[data-ai-id="image-builder:refresh"]')
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(
        lambda request: "s2ibuilder" in request.url and request.method == "GET", timeout=30_000
    ):
        refresh.click()
    screenshot(ui.page, "remaining-lists-refresh")
