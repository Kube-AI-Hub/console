from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

COLLECTION = "/apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards"


def dashboard_manifest(name: str) -> dict:
    return {
        "apiVersion": "monitoring.kubesphere.io/v1alpha2",
        "kind": "ClusterDashboard",
        "metadata": {"name": name},
        "spec": {
            "title": f"面板渲染用例 {name}",
            "editable": True,
            "panels": [
                {"id": 1, "type": "row", "title": "第一分区"},
                {"id": 2, "type": "singlestat", "title": "样本总数", "decimals": 0, "targets": [{"expr": "sum(up)"}]},
                {"id": 3, "type": "graph", "title": "在线目标", "targets": [{"expr": "sum(up)"}]},
                {
                    "id": 4,
                    "type": "graph",
                    "title": "坏表达式",
                    "targets": [{"expr": "no_such_metric_for_the_panels_case"}],
                },
            ],
        },
    }


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DASHBOARD_PANELS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DASHBOARD_PANELS-01 仪表板面板渲染。"""

    ui = cluster_management_page
    assert ui.api is not None

    name = f"tc-panels-{uuid.uuid4().hex[:8]}"
    status, body = ui.api.request("POST", COLLECTION, dashboard_manifest(name))
    if status not in (200, 201):
        pytest.skip(f"无法创建仪表板（{status}）：{str(body)[:200]}")

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/custom-monitoring/{name}")
        surface = ui.page.locator('[data-ai-id="dashboard-panels:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        # Read-only note and the row panel as a heading, not a query.
        expect(ui.page.locator('[data-ai-id="dashboard-panels:readonly-note"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="dashboard-panels:row:0"]')).to_have_text("第一分区")

        # singlestat: a number, from sum(up).
        stat = ui.page.locator('[data-ai-id="dashboard-panels:panel:1:value"]')
        expect(stat).to_be_visible(timeout=60_000)
        assert stat.inner_text().strip() != "", "singlestat 面板没有数值"

        # graph: a drawn line.
        expect(ui.page.locator('[data-ai-id="dashboard-panels:panel:2:chart"]')).to_be_visible(timeout=60_000)

        # The broken expression must not take the rest down: its own panel reports the problem.
        broken = ui.page.locator('[data-ai-id="dashboard-panels:panel:3:empty"]')
        expect(broken).to_be_visible(timeout=60_000)
        expect(ui.page.locator('[data-ai-id="dashboard-panels:panel:1:value"]')).to_be_visible()

        # Switching the window re-reads.
        with ui.page.expect_request(
            lambda request: "/proxy/api/v1/query_range" in request.url, timeout=30_000
        ):
            ui.page.locator('[data-ai-id="dashboard-panels:range:24h"]').click()

        screenshot(ui.page, "dashboard-panels")
    finally:
        ui.api.request("DELETE", f"{COLLECTION}/{name}")
