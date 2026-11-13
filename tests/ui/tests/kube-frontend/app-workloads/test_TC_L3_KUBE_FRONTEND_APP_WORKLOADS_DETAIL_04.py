from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

HPA = "/apis/autoscaling/v2/namespaces/default/horizontalpodautoscalers"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_04(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-04 负载详情：自动伸缩区块。"""

    ui = app_workloads_page
    assert ui.api is not None
    scaled = ui.unique("hpa")
    plain = ui.unique("nohpa")
    ui.create_deployment(scaled, replicas=1, image="nginx:1.27")
    ui.create_deployment(plain, replicas=1, image="nginx:1.27")
    status, _ = ui._request(
        "POST",
        HPA,
        {
            "apiVersion": "autoscaling/v2",
            "kind": "HorizontalPodAutoscaler",
            "metadata": {"name": scaled, "namespace": "default"},
            "spec": {
                "scaleTargetRef": {"apiVersion": "apps/v1", "kind": "Deployment", "name": scaled},
                "minReplicas": 1,
                "maxReplicas": 3,
                "metrics": [
                    {"type": "Resource", "resource": {"name": "cpu", "target": {"type": "Utilization", "averageUtilization": 30}}}
                ],
            },
        },
    )
    assert status in (200, 201), status
    try:
        ui.page.goto(f"{ui.base}/deployments/{scaled}")
        surface = ui.detail_surface("deployments")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        block = ui.page.locator('[data-ai-id="deployments-detail:autoscaling"]')
        expect(block).to_be_visible(timeout=20_000)
        text = block.inner_text()
        # The range and the metric are what an operator checks: how far it may grow and
        # what makes it grow.
        assert "1 – 3" in text, text
        assert "cpu" in text and "30%" in text, text

        # A workload without an autoscaler shows no block at all; an empty block would
        # be noise on every workload in the project.
        ui.page.goto(f"{ui.base}/deployments/{plain}")
        expect(ui.detail_surface("deployments")).to_be_visible(timeout=30_000)
        expect(ui.detail_surface("deployments")).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.locator('[data-ai-id="deployments-detail:autoscaling"]')).to_have_count(0)
        screenshot(ui.page, "workload-autoscaling")
    finally:
        ui._request("DELETE", f"{HPA}/{scaled}")
        ui.delete_deployment(scaled)
        ui.delete_deployment(plain)
