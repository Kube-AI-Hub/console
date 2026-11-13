from __future__ import annotations

import re
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/apis/cluster.kubesphere.io/v1alpha1/clusters"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_SWITCH_01(cluster_fleet_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01 集群切换：侧栏顶部切换器跳到目标集群概览。"""

    ui = cluster_fleet_page
    assert ui.api is not None
    origin = ui_config.cluster
    # A second cluster to switch to. It never becomes ready (proxy, no agent on this
    # platform), which is fine: switching is about navigating, not about health.
    target = f"tc-e2e-sw-{uuid.uuid4().hex[:6]}"
    body = {
        "apiVersion": "cluster.kubesphere.io/v1alpha1",
        "kind": "Cluster",
        "metadata": {"name": target},
        "spec": {"provider": "", "connection": {"type": "proxy"}, "joinFederation": True},
    }
    created, _ = ui.api.request("POST", CLUSTERS, body)
    assert created in (200, 201), created

    try:
        # Start inside the original cluster: the switcher belongs to the cluster console,
        # not to the fleet list.
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{origin}/overview")
        expect(ui.page.locator('[data-ai-id="overview:surface"]').last).to_be_visible(timeout=30_000)
        expect(ui.page.locator('[data-ai-id="shell:cluster-switcher"]').first).to_contain_text(origin)

        switcher = ui.open_switcher()
        expect(switcher.locator(f'[data-ai-id="clusters:switch-to:{target}"]')).to_be_visible(timeout=20_000)
        # The current cluster stays in the list, marked ready-or-not, so the reader can see
        # where they are as well as where they can go.
        assert switcher.locator(f'[data-ai-id="clusters:switch-to:{origin}"]').count() == 1

        switcher.locator(f'[data-ai-id="clusters:switch-to:{target}"]').click()
        # Overview, like the old console's `enterCluster`: not every cluster runs every
        # module, and the overview is what explains a missing one.
        expect(ui.page).to_have_url(re.compile(rf"/clusters/{re.escape(target)}/overview$"), timeout=30_000)
        expect(ui.page.locator('[data-ai-id="shell:cluster-switcher"]').first).to_contain_text(target)
        assert ui.active_nav() == "overview", ui.active_nav()
        screenshot(ui.page, "cluster-switch")

        # And back again — a one-way switch is not a switch.
        switcher = ui.open_switcher()
        switcher.locator(f'[data-ai-id="clusters:switch-to:{origin}"]').click()
        expect(ui.page).to_have_url(re.compile(rf"/clusters/{re.escape(origin)}/overview$"), timeout=30_000)
        expect(ui.page.locator('[data-ai-id="shell:cluster-switcher"]').first).to_contain_text(origin)
    finally:
        ui.api.request("DELETE", f"{CLUSTERS}/{target}")
