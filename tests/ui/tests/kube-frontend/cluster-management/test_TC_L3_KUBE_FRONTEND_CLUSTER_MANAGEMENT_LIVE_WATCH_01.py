from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_LIVE_WATCH_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LIVE_WATCH-01 容器组列表实时刷新。"""

    ui = cluster_management_page
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/pods")
    surface = ui.page.locator('[data-ai-id="cluster-pods:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    toggle = ui.page.locator('[data-ai-id="cluster-pods:live"]')
    expect(toggle).to_be_visible(timeout=20_000)
    expect(toggle).to_have_attribute("aria-pressed", "false")

    toggle.click()
    expect(toggle).to_have_attribute("aria-pressed", "true")
    state = ui.page.locator('[data-ai-id="cluster-pods:live-state"]')
    # Connecting is allowed briefly. A watch is live as soon as the response is open, even when
    # no change arrives in the window.
    expect(state).to_have_text("实时更新中", timeout=45_000)

    # The list must stay usable while the watch is open: a long connection that starves the proxy
    # would hang every other request, which is exactly the regression this guards.
    ui.workload_page_size("pods").click()
    ui.page.get_by_role("option", name="10", exact=True).click()
    expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)

    toggle.click()
    expect(toggle).to_have_attribute("aria-pressed", "false")
    expect(state).to_have_count(0, timeout=20_000)

    screenshot(ui.page, "cluster-pods-live")
