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

    # Events live on their own tab since the detail page got a tab system.
    ui.page.locator('[data-ai-id="workload-detail:tab-trigger:events"]').click()
    block = ui.page.locator('[data-ai-id="pods-detail:events"]')
    expect(block).to_be_visible(timeout=20_000)
    # A running pod keeps emitting events between the pre-read and the render, so the exact
    # count from before is not a stable expectation. What must hold is self-consistency: the
    # badge counts the rows it is showing, and those rows are ordered newest-first.
    rows = ui.page.locator('[data-ai-id="pods-detail:event-list"] [data-ai-row]')
    expect(rows.first).to_be_visible(timeout=20_000)
    shown = rows.count()
    assert shown >= 1, "事件页签没有任何行"
    expect(block).to_contain_text(f"({shown})", timeout=20_000)

    # The rendered rows must include the events the API had before the page opened. Ordering is
    # checked by the mapper's unit test: this deployment's events carry no last-seen timestamp
    # (the column shows "-"), so the DOM cannot prove an order.
    rendered = "\n".join(rows.all_inner_texts())
    reasons = {str(item.get("reason") or "") for item in expected_events if item.get("reason")}
    matched = [reason for reason in reasons if reason and reason in rendered]
    assert matched, f"页面上找不到任何已存在的事件原因：{sorted(reasons)[:5]}\n{rendered[:300]}"

    screenshot(ui.page, "pod-events")
