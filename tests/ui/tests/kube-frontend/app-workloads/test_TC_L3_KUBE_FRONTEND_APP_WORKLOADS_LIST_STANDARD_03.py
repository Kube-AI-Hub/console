from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SURFACE = '[data-ai-id="cluster-deployments:surface"]'
TREND_PANEL = '[data-ai-id="overview:trend"]'
TREND_SKELETON = '[data-ai-id="overview:trend:loading"]'
TREND_PLOT = '[data-ai-id="overview:trend:plot"]'
TREND_VEIL = '[data-ai-id="overview:trend:refreshing"]'


def _slow_metrics(page) -> None:
    """Delay the metric reads so first-load states can be observed.

    The local stack answers in milliseconds and a first load is gone before the
    assertion runs; a delay is what makes "the skeleton was there" observable at all.
    Only the range reads are slowed — pages, assets and the auth calls stay untouched.
    """

    page.add_init_script(
        """
        const original = window.fetch;
        window.fetch = async (...args) => {
            const url = String(args[0] && args[0].url ? args[0].url : args[0]);
            if (url.includes('monitoring.kubesphere.io')) {
                await new Promise((resolve) => setTimeout(resolve, 1200));
            }
            return original(...args);
        };
        """
    )


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_STANDARD_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03 首屏骨架与刷新遮罩不混用。"""

    ui = app_workloads_page
    _slow_metrics(ui.page)
    origin = ui.base.split("/kube-frontend/")[0]

    # ---- The list: a first load draws skeleton rows, never the veil. -------------
    ui.page.goto(f"{origin}/kube-frontend/clusters/{ui.cluster}/deployments")
    surface = ui.page.locator(SURFACE).last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).to_have_attribute("data-ai-state", "loading", timeout=20_000)
    # The veil means "content is on screen and being replaced"; on a first load
    # nothing is on screen, so a veil here would be a lie.
    assert ui.page.locator('[data-ai-id="table:refreshing"]').count() == 0, "首屏出现了刷新遮罩"
    screenshot(ui.page, "list-standard-first-load-skeleton")

    expect(surface).to_have_attribute("data-ai-state", "ready", timeout=90_000)
    expect(surface.locator("[data-ai-row]").first).to_be_visible(timeout=30_000)
    rows_before = surface.locator("[data-ai-row]").count()

    ui.page.locator('[data-ai-id="cluster-deployments:refresh"]').click()
    veil = ui.page.locator('[data-ai-id="table:refreshing"]')
    expect(veil).to_be_visible(timeout=10_000)
    assert surface.locator("[data-ai-row]").count() == rows_before, "刷新时行被清空"

    # ---- The chart: skeleton replaces the plot, and is exactly its height. ------
    ui.page.goto(f"{origin}/kube-frontend/clusters/{ui.cluster}/overview")
    panel = ui.page.locator(TREND_PANEL).last
    skeleton = ui.page.locator(TREND_SKELETON)
    expect(skeleton).to_be_visible(timeout=30_000)
    expect(ui.page.locator(TREND_PLOT)).to_have_count(0)
    heights = ui.page.evaluate(
        """() => {
            const skel = document.querySelector('[data-ai-id="overview:trend:loading"]');
            const box = skel && skel.parentElement;
            return { skeleton: skel ? Math.round(skel.getBoundingClientRect().height) : null,
                     box: box ? Math.round(box.getBoundingClientRect().height) : null };
        }"""
    )
    # The skeleton occupies the plot's box; stacking it above the plot made the panel
    # measure roughly twice its height on the first load.
    assert heights["skeleton"] == heights["box"], f"骨架没有占满绘图区，容器被撑高：{heights}"

    expect(panel).to_have_attribute("data-ai-state", "ready", timeout=90_000)
    expect(ui.page.locator(TREND_PLOT)).to_be_visible(timeout=30_000)
    ready_height = ui.page.locator(TREND_PLOT).evaluate("(el) => Math.round(el.getBoundingClientRect().height)")
    assert abs(ready_height - heights["box"]) <= 1, f"首屏与就绪态高度不一致：{heights} vs {ready_height}"

    # ---- A manual refresh veils the plot; the curve stays behind it. -------------
    ui.page.locator('[data-ai-id="overview:trend:refresh"]').click()
    expect(ui.page.locator(TREND_VEIL)).to_be_visible(timeout=10_000)
    expect(ui.page.locator(TREND_PLOT)).to_be_visible(timeout=5_000)
    screenshot(ui.page, "list-standard-chart-manual-refresh")
    expect(ui.page.locator(TREND_VEIL)).to_have_count(0, timeout=90_000)
