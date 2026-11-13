from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01 节点：列表五列与就绪状态。"""

    ui = cluster_management_page
    nodes = ui.list_nodes()
    if not nodes:
        pytest.skip("集群没有节点，无法核对节点列表")

    ui.open("nodes")
    ui.wait_ready("nodes")

    headers = ui.headers("nodes")
    # The usage columns replaced the raw capacity ones (see NODES-02): a node list that
    # shows `127600m` answers "how big", not "how busy".
    required = ["名称", "状态", "角色", "CPU 使用率", "内存使用率"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    names = ui.row_names("nodes")
    assert names, "node list rendered no rows"
    assert set(names) <= {n["metadata"]["name"] for n in nodes}

    first = ui.surface("nodes").locator(f'[data-ai-row="{names[0]}"]')
    text = first.inner_text()
    assert any(status in text for status in ("Ready", "NotReady", "Unknown")), text
    screenshot(ui.page, "cluster-nodes")
