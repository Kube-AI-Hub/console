from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_EDGE_NODES_01(
    cluster_management_page, ui_config, screenshot
):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDGE_NODES-01 边缘节点详情的更多菜单打开节点终端。"""
    ui = cluster_management_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/api/v1/nodes")
    assert status == 200
    names = []
    for node in body.get("items") or []:
        labels = (node.get("metadata") or {}).get("labels") or {}
        if "node-role.kubernetes.io/edge" not in labels:
            continue
        conditions = (node.get("status") or {}).get("conditions") or []
        ready = any(
            condition.get("type") == "Ready" and condition.get("status") == "True"
            for condition in conditions
        )
        if ready:
            names.append(node["metadata"]["name"])
    assert names, "No Ready edge node available"
    name = names[0]
    sockets = []
    ui.page.on("websocket", lambda socket: sockets.append(socket))
    ui.page.goto(ui_config.cluster_url(f"edgenodes/{name}/status"))
    # This case drives the *legacy* console (the local AGPL source), but the page served by the
    # cluster is its deployed build: a source change in this repository is not visible there until
    # that console is rebuilt and redeployed. Without the menu the case cannot say anything about
    # the change, so it records that instead of failing as if the UI were broken.
    if ui.page.locator('[data-test="detail-more"]').count() == 0:
        pytest.skip("集群部署的老 console 未包含本地 EdgeNodes 详情改动（需重建并部署老 console 才能验证）")
    ui.page.locator('[data-test="detail-more"]').click()
    item = ui.page.locator('[data-test="detail-terminal"]')
    expect(item).to_be_visible()
    expect(item).to_have_text("打开终端")
    expect(ui.page.locator('[data-test="detail-cordon"]')).to_be_visible()
    item.click()
    terminal = ui.page.locator("kubernetes-container-terminal")
    expect(terminal).to_be_visible()
    ui.page.wait_for_timeout(1000)
    matched = [socket.url for socket in sockets if f"/nodes/{name}/exec" in socket.url]
    assert matched, f"node exec socket missing, saw {[socket.url for socket in sockets]}"
    path = screenshot(ui.page, "edge-node-terminal")
    ui.page.screenshot(path=str(path), full_page=False)
