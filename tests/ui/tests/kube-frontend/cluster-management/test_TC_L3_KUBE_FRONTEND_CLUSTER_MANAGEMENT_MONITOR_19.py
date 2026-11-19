from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CARD = '[data-ai-id="cluster-monitor:resource:chart:gpu:gpuMemory"]'
SKELETON = '[data-ai-id="cluster-monitor:resource:chart:gpu:gpuMemory:loading"]'
EMPTY = '[data-ai-id="cluster-monitor:resource:chart:gpu:gpuMemory:empty"]'

HEIGHTS = """() => {
    const card = document.querySelector('%s');
    const skel = document.querySelector('%s');
    if (!card) return null;
    return {
        card: Math.round(card.getBoundingClientRect().height),
        rows: Array.from(card.children).map((child) => Math.round(child.getBoundingClientRect().height)),
        skeleton: skel ? Math.round(skel.getBoundingClientRect().height) : null,
    };
}""" % (CARD, SKELETON)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_19(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-19 图表卡片首屏骨架与就绪态同高。"""
    ui = cluster_management_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    # Hold the range read so the first-load state stays on screen long enough to read.
    held = []
    ui.page.route("**/kapis/**/monitoring.kubesphere.io/**", lambda route: held.append(route))
    ui.page.goto(f"{origin}/kube-frontend/clusters/{ui.cluster}/monitor?tab=resource")

    card = ui.page.locator(CARD).first
    expect(card).to_be_visible(timeout=30_000)
    expect(card).to_have_attribute("data-ai-state", "loading", timeout=20_000)
    expect(ui.page.locator(SKELETON)).to_be_visible(timeout=10_000)
    # The empty explanation belongs to an answer, not to the wait.
    expect(ui.page.locator(EMPTY)).to_have_count(0)

    loading = ui.page.evaluate(HEIGHTS)
    assert loading is not None, "首屏没有渲染图表卡片"
    # Three rows: the title line, the plot, the card's own legend. All three must
    # already be at their final heights, or the card changes size when data lands.
    assert len(loading["rows"]) == 3, f"卡片结构不是三段：{loading}"
    screenshot(ui.page, "monitor-card-skeleton")

    for route in held:
        route.continue_()
    ui.page.unroute("**/kapis/**/monitoring.kubesphere.io/**")

    expect(card).to_have_attribute("data-ai-state", "ready", timeout=90_000)
    expect(ui.page.locator(SKELETON)).to_have_count(0, timeout=10_000)
    ui.page.wait_for_timeout(500)
    ready = ui.page.evaluate(HEIGHTS)
    screenshot(ui.page, "monitor-card-ready")

    assert ready is not None, "数据到达后卡片消失了"
    assert abs(ready["card"] - loading["card"]) <= 1, f"首屏与就绪态卡片高度不同：{loading} vs {ready}"
    for index, (before, after) in enumerate(zip(loading["rows"], ready["rows"])):
        assert abs(after - before) <= 1, f"卡片第 {index + 1} 段高度变化：{before} → {after}"
