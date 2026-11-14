from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SERVICES = "/api/v1/namespaces/default/services"
PODS = "/api/v1/namespaces/default/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_SERVICE_PODS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICE_PODS-01 服务详情：关联容器组与端口。"""

    ui = app_workloads_page
    assert ui.api is not None
    deployment = ui.unique("svcowner")
    service = ui.unique("svcs")
    ui.create_deployment(deployment, replicas=2, image="nginx:1.27")
    status, _ = ui._request(
        "POST",
        SERVICES,
        {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {"name": service, "namespace": "default"},
            # A Service's selector is a flat map, unlike a workload's `matchLabels`.
            "spec": {"selector": {"app": deployment}, "ports": [{"name": "http", "port": 80, "targetPort": 80}]},
        },
    )
    assert status in (200, 201), status
    try:
        for _ in range(30):
            status, pods = ui._request("GET", f"{PODS}?labelSelector=app%3D{deployment}")
            if status == 200 and (pods.get("items") or []):
                break
            ui.page.wait_for_timeout(2000)
        expected = len(pods.get("items") or [])
        assert expected > 0, "the deployment started no pods"

        ui.page.goto(f"{ui.base}/services/{service}")
        surface = ui.detail_surface("services")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        # Both blocks belong on a service's page: how traffic comes in, and who serves it.
        expect(ui.page.locator('[data-ai-id="services-detail:ports"]')).to_be_visible()
        # Ports stay on the overview tab; the pod list has its own tab.
        ui.page.locator('[data-ai-id="workload-detail:tab-trigger:pods"]').click()
        block = ui.page.locator('[data-ai-id="services-detail:pods"]')
        expect(block).to_be_visible(timeout=30_000)
        expect(block.locator("tbody tr")).to_have_count(expected)
        screenshot(ui.page, "service-detail-pods")
    finally:
        ui._request("DELETE", f"{SERVICES}/{service}")
        ui.delete_deployment(deployment)
