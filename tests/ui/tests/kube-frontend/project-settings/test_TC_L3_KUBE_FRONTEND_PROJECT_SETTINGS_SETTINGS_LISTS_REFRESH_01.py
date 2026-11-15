from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_SETTINGS_LISTS_REFRESH_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-SETTINGS_LISTS_REFRESH-01 项目设置列表刷新。"""

    ui = project_settings_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    pages = [
        ("members", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/members"),
        ("roles", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/roles"),
        ("networkpolicies", f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/networkpolicies"),
    ]
    for handle, url in pages:
        ui.page.goto(url)
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        # A disabled button is the fingerprint of a schema memo that never sees the query settle.
        expect(button).to_be_enabled(timeout=60_000)

    # Clicking refresh re-issues the member list request.
    ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/members")
    refresh = ui.page.locator('[data-ai-id="members:refresh"]')
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(
        lambda request: "members" in request.url and request.method == "GET", timeout=30_000
    ):
        refresh.click()
    screenshot(ui.page, "project-settings-lists-refresh")
