from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NODES = "/kapis/resources.kubesphere.io/v1alpha3/nodes"
NODE_WRITE = "/api/v1/nodes"


def _node(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{NODE_WRITE}/{name}")
    return body if status == 200 and isinstance(body, dict) else None


def _unschedulable(api, name: str) -> bool:
    return ((_node(api, name) or {}).get("spec") or {}).get("unschedulable") is True


def _set(api, name: str, value: bool) -> int:
    status, _ = api.request(
        "PATCH",
        f"{NODE_WRITE}/{name}",
        {"spec": {"unschedulable": value}},
        "application/merge-patch+json",
    )
    return status


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_04(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04 节点列表：停止调度与启动调度。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{NODES}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取节点列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("集群没有节点")
    # A node the list actually renders: the kapis collection can include nodes the console does
    # not show, and cordoning one of those would assert against an invisible row.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes")
    surface = ui.page.locator('[data-ai-id="nodes:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    rendered = [row.get_attribute("data-ai-row") for row in surface.locator("[data-ai-row]").all()]
    names = [candidate for candidate in rendered if candidate]
    if not names:
        pytest.skip("节点列表没有渲染任何节点")
    name = names[0]
    node = next(item for item in items if item["metadata"]["name"] == name)
    original = ((node.get("spec") or {}).get("unschedulable")) is True

    try:
        # Start from a schedulable node: the case is about both directions.
        if original:
            _set(ui.api, name, False)

        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes")
        surface = ui.page.locator('[data-ai-id="nodes:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="停止调度", exact=True).click()

        deadline = time.time() + 30
        while time.time() < deadline:
            if _unschedulable(ui.api, name):
                break
            ui.page.wait_for_timeout(1_000)
        assert _unschedulable(ui.api, name), "停止调度后 spec.unschedulable 不是 true"
        expect(ui.page.locator(f'[data-ai-id="nodes:cordoned:{name}"]')).to_be_visible(timeout=20_000)

        # The two actions are mutually exclusive entries, not one label that changes:
        # a static label would claim the wrong state for half the rows.
        expect(row.locator('button[aria-haspopup="menu"]')).to_be_visible(timeout=20_000)
        row.locator('button[aria-haspopup="menu"]').click()
        labels = [item.strip() for item in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "启动调度" in labels and "停止调度" not in labels, labels
        ui.page.get_by_role("menuitem", name="启动调度", exact=True).click()

        deadline = time.time() + 30
        while time.time() < deadline:
            if not _unschedulable(ui.api, name):
                break
            ui.page.wait_for_timeout(1_000)
        assert not _unschedulable(ui.api, name), "启动调度后 spec.unschedulable 仍为 true"
        expect(ui.page.locator(f'[data-ai-id="nodes:cordoned:{name}"]')).to_have_count(0, timeout=20_000)

        screenshot(ui.page, "nodes-cordon")
    finally:
        # A cordoned node changes what the cluster accepts; never leave it behind.
        _set(ui.api, name, original)
        assert _unschedulable(ui.api, name) is original
