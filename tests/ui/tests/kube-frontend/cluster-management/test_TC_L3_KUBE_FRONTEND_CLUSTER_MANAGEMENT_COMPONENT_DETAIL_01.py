from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_COMPONENT_DETAIL_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01 系统组件详情与后端容器组。"""

    ui = cluster_management_page
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/components")
    surface = ui.page.locator('[data-ai-id="components:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # Enter through the real affordance: the component name is a link in the first row.
    link = ui.page.locator('[data-ai-id^="components:link:"]').first
    expect(link).to_be_visible(timeout=20_000)
    name = link.inner_text().strip()
    link.click()

    detail = ui.page.locator('[data-ai-id="component-detail"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(ui.page.get_by_role("heading", name=name)).to_be_visible()
    expect(ui.page.locator('[data-ai-id="component-detail:namespace"]')).to_be_visible()
    expect(ui.page.locator('[data-ai-id="component-detail:started-at"]')).to_be_visible()

    pods_table = ui.page.locator('[data-ai-id="component-detail:pods"]')
    no_pods = ui.page.locator('[data-ai-id="component-detail:no-pods"]')
    expect(pods_table.or_(no_pods)).to_be_visible(timeout=30_000)
    if pods_table.count():
        assert pods_table.locator("tbody tr").count() > 0

    screenshot(ui.page, "component-detail")
