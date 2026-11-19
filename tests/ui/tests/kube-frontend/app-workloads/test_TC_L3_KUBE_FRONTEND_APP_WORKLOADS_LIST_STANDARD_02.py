from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SURFACE = '[data-ai-id="deployments:surface"]'
STATUS_FILTER = '[data-ai-id="deployments:filter:status"]'
CLEAR_ALL = '[data-ai-id="deployments:filters-clear"]'


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_STANDARD_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02 列头筛选、说明与清除全部条件。"""

    ui = app_workloads_page
    ui.open("deployments")
    surface = ui.page.locator(SURFACE).last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    expect(surface.locator("[data-ai-row]").first).to_be_visible(timeout=30_000)

    # The field's filter belongs in its column header, not in the toolbar.
    in_header = ui.page.locator(f"thead th {STATUS_FILTER}")
    expect(in_header).to_have_count(1, timeout=10_000)
    rows_before = surface.locator("[data-ai-row]").count()

    ui.page.locator(STATUS_FILTER).click()
    options = ui.page.locator('[data-ai-id="deployments:filter:status:options"] [role="option"]')
    expect(options.first).to_be_visible(timeout=10_000)
    labels = [options.nth(index).inner_text().strip() for index in range(options.count())]
    assert labels == ["全部状态", "运行中", "更新中", "已停止"], labels

    # A value the project has none of: the empty state must say "no match", not "nothing here".
    ui.page.get_by_role("option", name="已停止", exact=True).click()
    expect(ui.page.locator(STATUS_FILTER)).to_have_attribute("data-active", "true", timeout=20_000)
    expect(surface).to_have_attribute("data-ai-state", "empty", timeout=60_000)
    body = surface.locator("tbody").inner_text()
    assert "没有匹配的结果" in body, body
    assert "暂无数据" not in body, body

    clear_all = ui.page.locator(CLEAR_ALL)
    expect(clear_all).to_be_visible(timeout=10_000)
    screenshot(ui.page, "list-standard-header-filter")

    clear_all.click()
    expect(ui.page.locator(STATUS_FILTER)).not_to_have_attribute("data-active", "true", timeout=20_000)
    expect(ui.page.locator(CLEAR_ALL)).to_have_count(0, timeout=10_000)
    expect(surface).to_have_attribute("data-ai-state", "ready", timeout=60_000)
    assert surface.locator("[data-ai-row]").count() == rows_before, "清除全部条件后没有恢复全集"

    # The header hint is a real control, and pressing it must not re-sort the column.
    # Three controls in this header answer to the column's name: the sort button (text
    # label), the filter trigger (aria-label + data-ai-id) and the hint (aria-label only).
    # The hint is the one without a data-ai-id.
    status_th = ui.page.locator("thead th", has=ui.page.locator(STATUS_FILTER)).first
    hint = status_th.locator('button[aria-label="状态"]:not([data-ai-id])')
    expect(hint).to_have_count(1, timeout=10_000)
    sort_before = status_th.get_attribute("aria-sort")
    expect(hint).to_be_visible(timeout=10_000)
    hint.click()
    # The tooltip is a visual surface without an ARIA role in this design system, so the
    # assertion is on the control that must be reachable and pressable without sorting.
    ui.page.wait_for_timeout(300)
    assert status_th.get_attribute("aria-sort") == sort_before, "点说明按钮触发了排序"
