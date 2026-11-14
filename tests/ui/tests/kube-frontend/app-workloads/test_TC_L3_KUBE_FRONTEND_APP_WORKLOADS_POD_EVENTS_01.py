from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/api/v1/namespaces/default/pods"
EVENTS = "/api/v1/namespaces/default/events"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_POD_EVENTS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01 容器组详情：事件。"""

    ui = app_workloads_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{PODS}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取容器组列表")
    pod_name = None
    expected_events = []
    for item in body.get("items") or []:
        name = item["metadata"]["name"]
        selector = f"involvedObject.name={name},involvedObject.kind=Pod"
        status, events = ui.api.request("GET", f"{EVENTS}?fieldSelector={selector}")
        if status != 200 or not isinstance(events, dict):
            continue
        items = events.get("items") or []
        if items:
            pod_name = name
            expected_events = items
            break
    if pod_name is None:
        pytest.skip("命名空间里没有带事件的容器组")

    ui.page.goto(f"{ui.base}/pods/{pod_name}")
    surface = ui.page.locator('[data-ai-id="pods-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    block = ui.page.locator('[data-ai-id="pods-detail:events"]')
    expect(block).to_be_visible(timeout=20_000)
    expect(block).to_contain_text(f"({len(expected_events)})", timeout=20_000)
    rows = ui.page.locator('[data-ai-id="pods-detail:event-list"] [data-ai-row]')
    expect(rows).to_have_count(len(expected_events), timeout=20_000)

    # Newest first: the page sorts by last-seen time, so the newest reason must be in the
    # first row.
    newest = max(expected_events, key=lambda item: str(item.get("lastTimestamp") or item.get("eventTime") or ""))
    first_row = rows.first.inner_text()
    assert str(newest.get("reason") or "") in first_row, first_row

    screenshot(ui.page, "pod-events")
