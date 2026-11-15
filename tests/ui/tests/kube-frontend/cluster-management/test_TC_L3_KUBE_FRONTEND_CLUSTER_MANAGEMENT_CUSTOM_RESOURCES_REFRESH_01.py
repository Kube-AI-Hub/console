from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER = "host"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CUSTOM_RESOURCES_REFRESH_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01 扩展资源列表刷新。"""

    ui = cluster_management_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    ui.page.goto(f"{origin}/kube-frontend/clusters/{CLUSTER}/custom-resources")
    refresh = ui.page.locator('[data-ai-id="custom-resources:refresh"]')
    expect(refresh).to_be_visible(timeout=60_000)
    # A disabled button is the fingerprint of a schema memo that never sees the query settle.
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(
        lambda request: "customresourcedefinitions" in request.url and request.method == "GET", timeout=30_000
    ):
        refresh.click()

    # Enter the first CRD and check the instance list carries its own control.
    row = ui.page.locator("[data-ai-row]").first
    expect(row).to_be_visible(timeout=30_000)
    name = row.get_attribute("data-ai-row") or ""
    assert name, "列表没有行，无法验证实例页刷新"
    ui.page.goto(f"{origin}/kube-frontend/clusters/{CLUSTER}/custom-resources/{name}")
    detail_refresh = ui.page.locator('[data-ai-id="custom-resource:refresh"]')
    expect(detail_refresh).to_be_visible(timeout=60_000)
    expect(detail_refresh).to_be_enabled(timeout=60_000)
    screenshot(ui.page, "custom-resources-refresh")
