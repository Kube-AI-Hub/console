from __future__ import annotations

import math

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02 节点列表：CPU 与内存使用率。"""

    ui = cluster_management_page
    with ui.page.expect_response(lambda response: "/monitoring.kubesphere.io/v1alpha3/nodes?" in response.url
                                 and "node_cpu_utilisation" in response.url) as captured:
        ui.open("nodes")
    assert captured.value.status == 200
    checked = 0
    for result in captured.value.json().get("results", []):
        kind = {"node_cpu_utilisation": "cpu", "node_memory_utilisation": "memory"}.get(result["metric_name"])
        if not kind:
            continue
        for sample in result.get("data", {}).get("result", []):
            value = float(sample["value"][1])
            name = sample["metric"]["node"]
            if math.isfinite(value) and name in ui.row_names():
                expect(ui.node_metric_value(kind, name)).to_have_text(f"{math.floor(value * 100 + .5)}%")
                checked += 1
    assert checked > 0, "No finite CPU or memory samples matched the node rows"
    screenshot(ui.page, "cluster-node-usage")
