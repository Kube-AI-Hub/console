from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_06(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06 区块位置、字段对齐与主题边框。"""
    ui = cluster_overview_page
    ui.open()
    ui.wait_ready()
    expect(ui.usage_field("gpu", "used")).not_to_have_text("-")
    sidebar = ui.control("identity-column")
    expect(sidebar.locator('[data-ai-id="overview:basic"] + [data-ai-id="overview:kubernetes-status"]')).to_be_visible()
    assert "GPU 利用率" not in ui.usage_text("gpu")
    for name in ("gpu-memory", "pods", "disk", "nodes"):
        expect(ui.usage_field(name, "allocated")).to_have_text("")
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        relative = {field: [] for field in ("name", "used", "total", "ratio", "allocated")}
        for name in ("gpu-memory", "gpu", "cpu", "memory", "pods", "disk", "nodes"):
            box = ui.usage_row(name).bounding_box()
            assert box
            for field in relative:
                cell = ui.usage_field(name, field).bounding_box()
                assert cell
                relative[field].append(cell["y"] - box["y"])
        for field, coordinates in relative.items():
            assert max(coordinates) - min(coordinates) < 2, f"{width} {field} 未对齐：{coordinates}"
        screenshot(ui.page, f"overview-aligned-{width}")
    reference = ui.page.context.new_page()
    try:
        reference.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes/gpu02")
        node = reference.locator('[data-ai-id="node-detail:basic"]')
        expect(node).to_be_visible()
        border = node.evaluate("element => getComputedStyle(element).borderTopColor")
        for panel in ui.surface.locator("section").all():
            assert panel.evaluate("element => getComputedStyle(element).borderTopColor") == border
    finally:
        reference.close()
    assert ui.control("usage").locator('svg use[href^="#icon-"]').count() >= 7
    expect(ui.control("ranking").get_by_role("progressbar").first).to_be_visible()
