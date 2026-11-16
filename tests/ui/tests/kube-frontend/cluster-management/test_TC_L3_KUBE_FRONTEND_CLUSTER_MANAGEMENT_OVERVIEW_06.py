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
    usage = ui.control("usage").bounding_box()
    ranking = ui.control("ranking").bounding_box()
    identity = ui.control("basic").bounding_box()
    assert usage and ranking and identity
    assert usage["y"] < ranking["y"] < identity["y"]
    assert "GPU 利用率" not in ui.usage_text("gpu")
    for name in ("gpu-memory", "pods", "disk", "nodes"):
        expect(ui.usage_field(name, "allocated")).to_have_text("")
    expect(ui.control("usage").locator('[data-ai-id="overview:usage-nodes"]')).to_have_count(0)
    expect(ui.control("node-summary").locator('[data-ai-id="overview:usage-nodes"]')).to_have_count(1)
    expect(ui.control("node-summary").locator('[data-ai-id$="-chart"], [data-ai-id$="-panel"]')).to_have_count(0)
    expect(ui.control("node-summary").get_by_role("button")).to_have_count(0)
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        relative = {field: [] for field in ("name", "used", "total", "ratio", "allocated")}
        for name in ("gpu-memory", "gpu", "cpu", "memory", "pods", "disk"):
            box = ui.usage_row(name).bounding_box()
            assert box
            for field in relative:
                cell = ui.usage_field(name, field).bounding_box()
                assert cell
                relative[field].append(cell["y"] - box["y"])
        for field, coordinates in relative.items():
            assert max(coordinates) - min(coordinates) < 2, f"{width} {field} 未对齐：{coordinates}"
        nodes_box = ui.control("node-summary").bounding_box()
        rank_box = ui.control("ranking").bounding_box()
        basic_box = ui.control("basic").bounding_box()
        status_box = ui.control("kubernetes-status").bounding_box()
        assert nodes_box and rank_box and basic_box and status_box
        assert abs(rank_box["width"] / nodes_box["width"] - 2) < .02
        assert abs(nodes_box["y"] - rank_box["y"]) < 2
        assert abs(nodes_box["x"] - basic_box["x"]) < 2
        assert abs(nodes_box["width"] - basic_box["width"]) < 2
        assert abs(nodes_box["width"] - status_box["width"]) < 2
        entries = ui.control("shortcuts").locator("nav > a, nav > button")
        expect(entries).to_have_count(4)
        boxes = [entry.bounding_box() for entry in entries.all()]
        assert all(boxes)
        assert max(box["width"] for box in boxes) - min(box["width"] for box in boxes) < 2
        assert max(box["height"] for box in boxes) - min(box["height"] for box in boxes) < 2
        offsets = [entry.evaluate("""element => {
            const box = element.getBoundingClientRect();
            const text = element.querySelector('span').getBoundingClientRect();
            const icon = element.querySelector('svg').getBoundingClientRect();
            return {textX: text.x - box.x, textY: text.y - box.y, iconX: icon.x - box.x};
        }""") for entry in entries.all()]
        for field in ("textX", "textY", "iconX"):
            assert max(offset[field] for offset in offsets) - min(offset[field] for offset in offsets) < 2
        if width == 1600:
            assert ui.control("ranking").bounding_box()["y"] < 900
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
    assert ui.control("usage").locator('svg use[href^="#icon-"]').count() >= 6
    expect(ui.control("ranking").get_by_role("progressbar").first).to_be_visible()
