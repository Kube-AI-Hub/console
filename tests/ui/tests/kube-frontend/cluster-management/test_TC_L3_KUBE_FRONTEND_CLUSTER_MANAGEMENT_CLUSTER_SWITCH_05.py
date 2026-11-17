from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/apis/cluster.kubesphere.io/v1alpha1/clusters"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_SWITCH_05(
        cluster_overview_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-05 未就绪集群不留上一集群数据。"""

    ui = cluster_overview_page
    assert ui.api is not None
    origin = ui_config.cluster
    target = f"tc-e2e-nr-{uuid.uuid4().hex[:6]}"
    created, _ = ui.api.request("POST", CLUSTERS, {
        "apiVersion": "cluster.kubesphere.io/v1alpha1",
        "kind": "Cluster",
        "metadata": {"name": target},
        "spec": {"provider": "", "connection": {"type": "proxy"}, "joinFederation": True},
    })
    assert created in (200, 201), created

    try:
        # Baseline: the source cluster is ready, so its overview has real numbers and rows.
        ui.open()
        ui.wait_ready()
        expect(ui.usage_row("cpu")).to_be_visible(timeout=60_000)
        origin_cpu = ui.usage_text("cpu")
        origin_nodes = ui.field_text("node-count")
        assert ui.ranking_rows().count() > 0

        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{target}/overview")
        expect(ui.page.locator('[data-ai-id="overview:surface"]').last).to_be_visible(timeout=30_000)

        # Monitoring cannot answer for a cluster whose agent never connected. What must not
        # happen is the previous cluster's numbers staying on screen: the panel is rebuilt
        # from a query keyed by the cluster in the address.
        expect(ui.control("no-metrics")).to_be_visible(timeout=60_000)
        assert ui.usage_row("cpu").count() == 0, ui.usage_text("cpu")
        assert origin_cpu not in ui.page.locator('[data-ai-id="overview:usage"]').last.inner_text()
        # The node block states that monitoring is unavailable rather than showing a rate.
        expect(ui.control("no-node-metrics")).to_be_visible(timeout=30_000)
        assert ui.usage_field("nodes", "used").count() == 0

        # The ranking and the component list fail with the reason the apiserver gave, not
        # with a claim about the network, and carry no rows from the cluster we came from.
        expect(ui.control("ranking")).to_contain_text(target, timeout=30_000)
        expect(ui.control("ranking")).not_to_contain_text("网络异常")
        assert ui.ranking_rows().count() == 0
        expect(ui.control("components")).to_contain_text("not ready", timeout=30_000)

        # Identity belongs to the target cluster: not ready, and its own node count.
        assert "未就绪" in ui.status_row, ui.status_row
        assert ui.field_text("node-count") != origin_nodes, (ui.field_text("node-count"), origin_nodes)
        screenshot(ui.page, "cluster-switch-not-ready")

        # A full reload reaches the same conclusion: the clearing is not a client-side
        # state reset that a refresh would undo.
        ui.page.reload()
        expect(ui.page.locator('[data-ai-id="overview:surface"]').last).to_be_visible(timeout=30_000)
        expect(ui.control("no-metrics")).to_be_visible(timeout=60_000)
        assert ui.usage_row("cpu").count() == 0
        assert ui.ranking_rows().count() == 0
    finally:
        ui.api.request("DELETE", f"{CLUSTERS}/{target}")
