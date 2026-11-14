from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_07(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-07 全局统计不受列表条件影响。"""
    ui = cluster_management_page
    assert ui.api is not None
    status, stats = ui.api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/nodes/stats?labelSelector=!node-role.kubernetes.io/edge")
    assert status == 200
    status, control = ui.api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/nodes?role=master&limit=1&labelSelector=!node-role.kubernetes.io/edge")
    assert status == 200
    ui.open("nodes")
    expect(ui.node_stat("total")).to_have_text(str(stats["total"]), timeout=30_000)
    expect(ui.node_stat("control-plane")).to_have_text(str(control["totalItems"]))
    if stats["total"]:
        expect(ui.node_stat("health")).to_have_text(f'{stats["healthy"] / stats["total"] * 100:.1f}%')
    for vendor, count in stats.items():
        if vendor not in ("total", "healthy"):
            expect(ui.node_stat(f"vendor:{vendor}")).to_have_text(str(count))
    ui.node_control("search").fill("no-node-matches-this-condition")
    expect(ui.rows()).to_have_count(0, timeout=20_000)
    expect(ui.node_stat("total")).to_have_text(str(stats["total"]))
    ui.node_control("filters-clear").click()
    expect(ui.rows().first).to_be_visible(timeout=20_000)
    screenshot(ui.page, "node-list-statistics")
