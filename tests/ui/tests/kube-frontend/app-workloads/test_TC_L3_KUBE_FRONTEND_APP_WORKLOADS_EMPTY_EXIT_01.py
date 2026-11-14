from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SURFACE = '[data-ai-id="pods:surface"]'
CLEAR = '[data-ai-id="empty-state:clear"]'
REFRESH = '[data-ai-id="empty-state:refresh"]'
MISSING = "zzz-definitely-no-such-pod"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EMPTY_EXIT_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EMPTY_EXIT-01 列表空态出口：清空搜索与筛选、刷新。"""

    ui = app_workloads_page
    page = ui.page
    page.goto(ui.url("pods"))
    surface = page.locator(SURFACE)
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    search = page.locator('[data-ai-id="pods:search"]').last
    search.fill(MISSING)
    expect(surface).to_have_attribute("data-ai-state", "empty", timeout=60_000)

    clear = page.locator(CLEAR)
    refresh = page.locator(REFRESH)
    expect(clear).to_be_visible(timeout=30_000)
    expect(refresh).to_be_visible()
    assert clear.inner_text().strip(), clear.inner_text()
    assert refresh.inner_text().strip(), refresh.inner_text()

    # One click must get the reader out: search cleared and the list back to rows.
    clear.click()
    expect(surface).not_to_have_attribute("data-ai-state", "empty", timeout=60_000)
    expect(surface).to_have_attribute("data-ai-state", "ready", timeout=60_000)
    assert search.input_value() == ""

    # Empty again, then refresh must actually re-read the list rather than just redraw.
    search.fill(MISSING)
    expect(surface).to_have_attribute("data-ai-state", "empty", timeout=60_000)
    with page.expect_response(
        lambda response: response.request.method == "GET"
        and "/pods" in response.url
        and "limit=" in response.url,
        timeout=60_000,
    ) as info:
        page.locator(REFRESH).click()
    assert info.value.status == 200, info.value.status
    screenshot(page, "empty-state-exit")
