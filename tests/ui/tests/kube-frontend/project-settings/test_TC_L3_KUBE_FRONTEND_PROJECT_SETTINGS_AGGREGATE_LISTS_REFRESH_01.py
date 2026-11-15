from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_AGGREGATE_LISTS_REFRESH_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-AGGREGATE_LISTS_REFRESH-01 聚合型列表刷新。"""

    ui = project_settings_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    # Cluster resource monitor: two sources, one button.
    ui.page.goto(f"{origin}/kube-frontend/clusters/{CLUSTER}/monitor-resource")
    monitor = ui.page.locator('[data-ai-id="cluster-resource-monitor:refresh"]')
    expect(monitor).to_be_visible(timeout=60_000)
    expect(monitor).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(lambda request: "/pods" in request.url and request.method == "GET", timeout=30_000):
        monitor.click()

    # Workspace member detail: the table receives its rows, so the handle carries the tab name.
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/members/admin")
    detail = ui.page.locator('[data-ai-id^="workspace-member-"][data-ai-id$=":refresh"]')
    expect(detail.first).to_be_visible(timeout=60_000)
    expect(detail.first).to_be_enabled(timeout=60_000)
    screenshot(ui.page, "aggregate-lists-refresh")
