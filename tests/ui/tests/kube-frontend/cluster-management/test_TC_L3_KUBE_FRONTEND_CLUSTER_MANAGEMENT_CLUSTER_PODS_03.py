from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_PODS_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-03 分页档位与刷新。"""
    ui = cluster_management_page
    ui.page.goto(ui.url("pods"))
    surface = ui.workload_surface("pods")
    expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)
    expect(surface).to_have_attribute("data-ai-state", "ready")
    picker = ui.workload_page_size("pods")
    # The page-size control is a Radix combobox (a button), not a native select.
    expect(picker).to_contain_text("20")
    expect(ui.workload_next("pods")).to_be_enabled()
    ui.workload_next("pods").click()
    expect(ui.workload_current_page("pods")).to_have_text("2")
    expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)

    def matches(response):
        parsed = urlparse(response.url)
        params = parse_qs(parsed.query)
        return parsed.path.endswith("/pods") and params.get("limit") == ["50"] and params.get("page") == ["1"]

    with ui.page.expect_response(matches, timeout=60_000) as pending:
        picker.click()
        ui.page.get_by_role("option", name="50", exact=True).click()
    response = pending.value
    assert response.ok
    expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)
    expect(ui.workload_current_page("pods")).to_have_text("1")
    expect(ui.rows("cluster-pods")).to_have_count(len(response.json()["items"]))
    with ui.page.expect_response(matches, timeout=60_000) as refreshed:
        ui.workload_refresh("pods").click()
    assert refreshed.value.ok
    expect(picker).to_contain_text("50")
    expect(surface).to_have_attribute("aria-busy", "false", timeout=60_000)
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        expect(picker).to_be_visible()
        screenshot(ui.page, f"cluster-pods-page-size-{width}")
