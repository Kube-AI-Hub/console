from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

HISTOGRAM = "/kapis/tenant.kubesphere.io/v1alpha2/events?operation=histogram"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_EVENTS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-02 事件检索：柱状图与过滤条件。"""

    ui = cluster_management_page
    assert ui.api is not None

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/events")
    surface = ui.page.locator('[data-ai-id="cluster-events:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # The histogram renders either bars or an explicit empty/unavailable note.
    histogram = ui.page.locator('[data-ai-id="cluster-events:histogram"]')
    expect(histogram).to_be_visible(timeout=30_000)
    has_bars = ui.page.locator('[data-ai-id="cluster-events:histogram:bars"] li').count() > 0
    has_note = (
        ui.page.locator('[data-ai-id="cluster-events:histogram:empty"]').count()
        + ui.page.locator('[data-ai-id="cluster-events:histogram:error"]').count()
    ) > 0
    assert has_bars or has_note, "柱状图既没有柱子也没有说明"
    expect(ui.page.locator('[data-ai-id="cluster-events:histogram:total"]')).to_be_visible()

    before = ui.page.locator('[data-ai-id="cluster-events:total"]').inner_text()

    # A reason filter that cannot match anything must empty the list and change the total.
    ui.page.locator('[data-ai-id="cluster-events:filter:reason"]').fill("tc-no-such-reason-xyz")
    with ui.page.expect_request(
        lambda request: HISTOGRAM in request.url and "reason_filter=tc-no-such-reason-xyz" in request.url,
        timeout=30_000,
    ):
        ui.page.locator('[data-ai-id="cluster-events:search"]').click()
    expect(ui.page.locator('[data-ai-id="cluster-events:empty"]')).to_be_visible(timeout=30_000)
    after = ui.page.locator('[data-ai-id="cluster-events:total"]').inner_text()
    assert "0" in after, after
    assert before != after, (before, after)

    # Reset returns to the unfiltered result set.
    with ui.page.expect_request(
        lambda request: HISTOGRAM in request.url and "reason_filter" not in request.url,
        timeout=30_000,
    ):
        ui.page.locator('[data-ai-id="cluster-events:reset"]').click()
    expect(ui.page.locator('[data-ai-id="cluster-events:total"]')).to_have_text(before, timeout=30_000)
    screenshot(ui.page, "cluster-events-filters")
