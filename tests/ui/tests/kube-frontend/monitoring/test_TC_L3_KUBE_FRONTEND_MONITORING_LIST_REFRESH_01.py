from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_LIST_REFRESH_01(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-LIST_REFRESH-01 监控告警页族的列表刷新。"""

    ui = monitoring_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    project_pages = [
        ("alerts", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/alerts"),
        ("alertingrules", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/alertingrules"),
    ]
    for handle, url in project_pages:
        ui.page.goto(url)
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        expect(button).to_be_enabled(timeout=60_000)

    cluster_pages = [
        ("cluster-alerting-messages", f"{origin}/kube-frontend/clusters/{CLUSTER}/alerting-messages"),
        ("cluster-alerting-policies", f"{origin}/kube-frontend/clusters/{CLUSTER}/alerting-policies"),
    ]
    for handle, url in cluster_pages:
        ui.page.goto(url)
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        expect(button).to_be_enabled(timeout=60_000)

    # The custom monitoring page renders its own empty block when there is no dashboard; either that
    # block or the list itself must carry the control. Wait for the page to settle first: reading the
    # counts while it is still loading sees neither.
    ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/custom-monitoring")
    surface = ui.page.locator('[data-ai-id="project-custom-monitoring:surface"]').last
    expect(surface).to_be_visible(timeout=60_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    empty_refresh = ui.page.locator('[data-ai-id="project-custom-monitoring:empty:refresh"]')
    list_refresh = ui.page.locator('[data-ai-id="project-custom-monitoring:refresh"]')
    deadline = time.time() + 30
    while time.time() < deadline and empty_refresh.count() == 0 and list_refresh.count() == 0:
        ui.page.wait_for_timeout(500)
    assert empty_refresh.count() + list_refresh.count() == 1, "自定义监控页没有刷新入口"

    # Clicking refresh re-issues the alerting request.
    ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/alerts")
    expect(ui.page.locator('[data-ai-id="alerts:refresh"]')).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(lambda request: "alerting.kubesphere.io" in request.url, timeout=30_000):
        ui.page.locator('[data-ai-id="alerts:refresh"]').click()
    screenshot(ui.page, "monitoring-list-refresh")
