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
        ui.open()
        ui.wait_ready()
        origin_usage = ui.usage_text("cpu")
        origin_nodes = ui.usage_field("nodes", "used").inner_text().strip()
        origin_rows = ui.ranking_rows().count()

        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{target}/overview")
        expect(ui.page.locator('[data-ai-id="overview:surface"]').last).to_be_visible(timeout=30_000)

        # Monitoring cannot answer for a cluster whose agent is not connected. What must
        # not happen is the previous cluster's numbers staying on screen: the old code read
        # them from a cache keyed only by what the query happened to send.
        expect(ui.page.locator('[data-ai-id="overview:no-metrics"]').last).to_be_visible(timeout=30_000)
        assert ui.usage_text("cpu") == "集群资源总量与用量\n点击资源查看趋势\n\n监控数据不可用", ui.usage_text("cpu")
        assert origin_usage not in ui.usage_text("cpu")
        assert ui.usage_field("nodes", "used").count() == 0
        # The node block says monitoring is unavailable rather than showing a ready count.
        expect(ui.control("no-node-metrics")).to_be_visible(timeout=30_000)

        # The ranking and the component list fail with the reason, not with a network claim,
        # and carry no rows from the cluster the reader came from.
        expect(ui.control("ranking")).to_contain_text(target, timeout=30_000)
        expect(ui.control("ranking")).not_to_contain_text("网络异常")
        assert ui.ranking_rows().count() == 0
        expect(ui.control("components")).to_contain_text("not ready", timeout=30_000)

        # Identity is the target cluster's own: not ready, and its node count, not the other's.
        assert "未就绪" in ui.status_row, ui.status_row
        assert ui.field_text("node-count") != origin_nodes, (ui.field_text("node-count"), origin_nodes)
        assert origin_rows > 0  # the fixture cluster had rows; the switch dropped them
        screenshot(ui.page, "cluster-switch-not-ready")

        # A full reload must reach the same conclusion: the old data must not have been
        # only cleared by a client-side state reset.
        ui.page.reload()
        expect(ui.page.locator('[data-ai-id="overview:no-metrics"]').last).to_be_visible(timeout=30_000)
        assert ui.usage_field("nodes", "used").count() == 0
        assert ui.ranking_rows().count() == 0
    finally:
        ui.api.request("DELETE", f"{CLUSTERS}/{target}")
