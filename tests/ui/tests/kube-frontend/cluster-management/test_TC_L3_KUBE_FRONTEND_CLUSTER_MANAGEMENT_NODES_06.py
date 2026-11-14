from __future__ import annotations

from urllib.parse import quote
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_06(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06 节点关联资源与元数据编辑。"""
    ui = cluster_management_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/api/v1/nodes")
    assert status == 200 and body["items"]
    node = body["items"][0]
    name = node["metadata"]["name"]
    path = f"/api/v1/nodes/{quote(name)}"
    label = f"test.console/node-{uuid4().hex[:8]}"
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes/{name}")
    expect(ui.page.locator('[data-ai-id="node-detail:basic"]')).to_be_visible()
    try:
        ui.page.locator('[data-ai-id="node-detail:tab:metadata"]').click()
        ui.page.locator('[data-ai-id="node-detail:edit-labels"]').click()
        dialog = ui.page.get_by_role("dialog")
        dialog.get_by_placeholder("键", exact=True).fill(label)
        dialog.get_by_placeholder("值", exact=True).fill("verified")
        dialog.get_by_role("button", name="添加", exact=True).click()
        dialog.get_by_role("button", name="确认", exact=True).click()
        expect(dialog).to_have_count(0, timeout=20_000)
        status, saved = ui.api.request("GET", path)
        assert status == 200 and saved["metadata"]["labels"][label] == "verified"
        expect(ui.page.locator('[data-ai-id="node-detail:labels"]')).to_contain_text(f"{label}=verified")
        ui.page.locator('[data-ai-id="node-detail:edit-taints"]').click()
        dialog.get_by_role("textbox", name="污点", exact=True).fill("- key: bad\n  effect: Invalid")
        dialog.get_by_role("button", name="确认", exact=True).click()
        expect(dialog).to_contain_text("effect 只能是")
        dialog.get_by_role("button", name="取消", exact=True).click()
        status, untouched = ui.api.request("GET", path)
        assert status == 200 and untouched.get("spec", {}).get("taints", []) == node.get("spec", {}).get("taints", [])
        ui.page.locator('[data-ai-id="node-detail:tab:pods"]').click()
        expect(ui.page.locator('[data-ai-id="node-detail:pods"]')).to_be_visible()
        status, pods = ui.api.request("GET", f"/api/v1/pods?fieldSelector=spec.nodeName%3D{quote(name)}")
        assert status == 200
        if pods.get("items"):
            expect(ui.page.locator('[data-ai-id="node-detail:pods"] [data-ai-row]').first).to_be_visible(timeout=30_000)
        ui.page.locator('[data-ai-id="node-detail:tab:events"]').click()
        expect(ui.page.locator('[data-ai-id="node-detail:events"]')).to_be_visible()
        ui.page.locator('[data-ai-id="node-detail:tab:monitor"]').click()
        expect(ui.page.locator('[data-ai-id="node-detail:monitor"]')).to_have_attribute("data-ai-state", "ready", timeout=30_000)
        chart = ui.page.locator('[data-ai-id="node-detail:chart:cpu"] svg')
        expect(chart).to_be_visible(timeout=30_000)
        assert "L" in chart.locator("path").get_attribute("d"), "Node CPU chart has no trend samples"
        screenshot(ui.page, "node-monitor")
    finally:
        status, response = ui.api.request("PATCH", path, {"metadata": {"labels": {label: None}}},
                                          content_type="application/merge-patch+json")
        assert status == 200, f"Failed to clean up test node label: {response}"
