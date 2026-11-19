from __future__ import annotations

from urllib.parse import quote
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _nodes(api, cluster: str) -> list[dict]:
    prefix = "" if cluster == "host" else f"/clusters/{cluster}"
    status, body = api.request("GET", f"/kapis{prefix}/resources.kubesphere.io/v1alpha3/nodes?limit=-1")
    assert status == 200, body
    return body.get("items") or []


def _taints(api, cluster: str, name: str) -> list[dict]:
    """Taints of one node, read from the same collection the list renders."""
    return next((item for item in _nodes(api, cluster) if item["metadata"]["name"] == name),
                {}).get("spec", {}).get("taints") or []


def _set_taints(api, cluster: str, name: str, taints: list[dict]) -> int:
    """
    Write taints, used only for setup and cleanup.

    The console refuses member-cluster writes (the core group has no member-cluster
    form), so this helper also only works on the host cluster — which is where the
    case runs.
    """
    assert cluster == "host", "成员集群的节点写入后端不支持，用例只在 host 上运行"
    status, body = api.request("GET", f"/api/v1/nodes/{quote(name)}")
    assert status == 200, body
    status, _ = api.request(
        "PATCH",
        f"/api/v1/nodes/{quote(name)}",
        {"metadata": {"resourceVersion": body["metadata"]["resourceVersion"]}, "spec": {"taints": taints}},
        "application/merge-patch+json",
    )
    return status


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_13(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-13 节点列表 · 批量编辑污点。"""
    ui = cluster_management_page
    assert ui.api is not None
    nodes = _nodes(ui.api, ui.cluster)
    if len(nodes) < 2:
        pytest.skip("批量编辑需要至少两个节点")
    names = [item["metadata"]["name"] for item in nodes[:2]]
    originals = {name: _taints(ui.api, ui.cluster, name) for name in names}
    key = f"test.console-batch-{uuid4().hex[:8]}"

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes")
        surface = ui.page.locator('[data-ai-id="nodes:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        bulk = ui.page.locator('[data-ai-id="nodes:bulk-taints"]')
        # The bulk button is mounted but disabled until something is selected: an absent
        # control reads as a missing feature, and the reader would not know it exists.
        expect(bulk).to_be_disabled()
        for name in names:
            ui.page.locator(f'[data-ai-id="nodes:select:{name}"]').check()
        expect(bulk).to_be_enabled()
        bulk.click()

        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_contain_text("批量编辑污点", timeout=20_000)
        expect(dialog).to_contain_text("公共污点")
        expect(dialog).to_contain_text("各节点独有污点")

        common = dialog.locator('[data-ai-id="node-taints:common:editor"]')
        common.get_by_role("button", name="添加污点", exact=True).click()
        row = common.locator('[data-ai-id="node-taints:common:row:0"]')
        row.get_by_role("textbox", name="键", exact=True).fill(key)
        row.get_by_role("textbox", name="值", exact=True).fill("verified")
        dialog.get_by_role("button", name="确认", exact=True).click()

        # The shared block goes to every selected node.
        expect(dialog.locator('[data-ai-id="node-taints-bulk:result"]')).to_contain_text("已更新", timeout=30_000)
        for name in names:
            assert any(taint["key"] == key for taint in _taints(ui.api, ui.cluster, name)), f"{name} 未写入公共污点"

        screenshot(ui.page, "nodes-bulk-taints")
        dialog.get_by_role("button", name="关闭", exact=True).click()

        # The row menu is the single-node entry point and must open the same dialog.
        row_actions = surface.locator(f'[data-ai-row="{names[0]}"] button[aria-haspopup="menu"]')
        row_actions.click()
        ui.page.get_by_role("menuitem", name="编辑污点", exact=True).click()
        expect(dialog).to_contain_text("批量编辑污点", timeout=20_000)
        # One node: the split collapses into a single list, with no per-node section.
        expect(dialog).to_contain_text("污点")
        expect(dialog).not_to_contain_text("各节点独有污点")
        dialog.get_by_role("button", name="取消", exact=True).click()
    finally:
        # Taints change what the scheduler accepts; never leave a test taint behind.
        for name, taints in originals.items():
            assert _set_taints(ui.api, ui.cluster, name, taints) == 200
            assert _taints(ui.api, ui.cluster, name) == taints
