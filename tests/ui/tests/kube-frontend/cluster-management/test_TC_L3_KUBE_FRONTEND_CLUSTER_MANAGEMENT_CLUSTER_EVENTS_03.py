from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _total(page) -> int:
    text = page.locator('[data-ai-id="cluster-events:total"]').inner_text()
    digits = "".join(ch for ch in text if ch.isdigit())
    return int(digits or 0)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_EVENTS_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-03 时间段选择与实时刷新。"""

    ui = cluster_management_page
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/events")
    surface = ui.page.locator('[data-ai-id="cluster-events:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    bars = ui.page.locator('[data-ai-id^="cluster-events:bucket:"]')
    if bars.count() == 0:
        pytest.skip("最近 12 小时没有事件，柱状图无柱可选")

    before = _total(ui.page)

    # Clicking a bar narrows the list to that bucket's window.
    last = bars.nth(bars.count() - 1)
    last.click()
    expect(ui.page.locator('[data-ai-id="cluster-events:selected-range"]')).to_be_visible(timeout=30_000)
    expect(last).to_have_attribute("aria-pressed", "true")
    ui.page.wait_for_timeout(2_500)
    after = _total(ui.page)
    assert after < before, f"选中时间段后总数应下降：{before} -> {after}"

    # Clicking the same bar again clears the selection.
    last.click()
    expect(ui.page.locator('[data-ai-id="cluster-events:selected-range"]')).to_have_count(0, timeout=30_000)
    ui.page.wait_for_timeout(2_500)
    assert _total(ui.page) == before, "清除时间段后总数应恢复"

    # Real time: requests keep coming while on, and stop when off.
    requests: list[str] = []
    ui.page.on(
        "request",
        lambda request: requests.append(request.url)
        if "/tenant.kubesphere.io/v1alpha2/events" in request.url
        else None,
    )
    toggle = ui.page.locator('[data-ai-id="cluster-events:real-time"]')
    expect(toggle).to_have_attribute("aria-pressed", "false")
    toggle.click()
    expect(toggle).to_have_attribute("aria-pressed", "true")
    ui.page.wait_for_timeout(12_000)
    during = len(requests)
    assert during >= 2, f"实时开启后 12 秒内只新增 {during} 次请求"

    toggle.click()
    expect(toggle).to_have_attribute("aria-pressed", "false")
    settled = len(requests)
    ui.page.wait_for_timeout(8_000)
    assert len(requests) == settled, "关闭实时后仍在发起定时请求"
    screenshot(ui.page, "cluster-events-bucket")
