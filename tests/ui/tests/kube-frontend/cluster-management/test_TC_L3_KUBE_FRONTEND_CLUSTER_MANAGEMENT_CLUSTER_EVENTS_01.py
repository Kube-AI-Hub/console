from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

EVENTS = "/api/v1/events"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_EVENTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01 资源事件查询。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{EVENTS}?limit=200")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取集群事件")
    items = body.get("items") or []
    if not items:
        pytest.skip("集群没有事件")

    def last_seen(item: dict) -> str:
        return str(item.get("lastTimestamp") or item.get("eventTime") or item.get("firstTimestamp") or "")

    newest = max(items, key=last_seen)

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/events")
    surface = ui.page.locator('[data-ai-id="cluster-events:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    rows = ui.page.locator('[data-ai-id="cluster-events:list"] [data-ai-row]')
    expect(rows).to_have_count(len(items), timeout=30_000)
    first_row = rows.first.inner_text()
    assert str(newest.get("reason") or "") in first_row, first_row

    if len(items) >= 200:
        expect(ui.page.locator('[data-ai-id="cluster-events:window"]')).to_be_visible(timeout=20_000)

    # The type filter goes to the API with a fieldSelector, so every visible badge must be
    # Warning afterwards.
    ui.page.locator('[data-ai-id="cluster-events:filter:type"]').select_option("Warning")
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(rows.first).to_be_visible(timeout=30_000)
    sample = [rows.nth(index).inner_text() for index in range(min(5, rows.count()))]
    assert all("Warning" in text for text in sample), sample

    screenshot(ui.page, "cluster-events")
