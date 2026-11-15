from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER = "host"


def _monitor_requests(page) -> list[str]:
    return [url for url in getattr(page, "_monitor_urls", [])]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_04(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-04 集群监控：自动刷新开关。"""

    ui = cluster_management_page
    origin = ui.base_url.split("/kube-frontend/")[0]
    requests: list[str] = []
    ui.page.on(
        "request",
        lambda request: requests.append(request.url)
        if "/kapis/monitoring" in request.url and "cluster?" in request.url
        else None,
    )

    ui.page.goto(f"{origin}/kube-frontend/clusters/{CLUSTER}/monitor")
    surface = ui.page.locator('[data-ai-id="cluster-monitor:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    toggle = ui.page.locator('[data-ai-id="cluster-monitor:auto-refresh"]')
    expect(toggle).to_be_visible(timeout=30_000)
    expect(toggle).to_have_attribute("aria-pressed", "false")
    initial = len(requests)

    toggle.click()
    expect(toggle).to_have_attribute("aria-pressed", "true")
    # Two five-second ticks plus slack; asking for exactly two would be a timing test, not a
    # behaviour test.
    ui.page.wait_for_timeout(12_000)
    during = len(requests)
    assert during - initial >= 2, f"自动刷新开启后 12 秒内只新增 {during - initial} 次请求"

    toggle.click()
    expect(toggle).to_have_attribute("aria-pressed", "false")
    after_off = len(requests)
    ui.page.wait_for_timeout(8_000)
    assert len(requests) == after_off, "关闭自动刷新后仍在发起定时请求"
    screenshot(ui.page, "cluster-monitor-auto-refresh")
