from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_03(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-03 删除自制应用。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crddel-{stamp}"
    workload = f"{name}-web"
    application = {
        "apiVersion": "app.k8s.io/v1beta1",
        "kind": "Application",
        "metadata": {"name": name, "namespace": NAMESPACE, "labels": {"app.kubernetes.io/version": "v1"}},
        "spec": {"selector": {"matchLabels": {"app": name}}, "addOwnerRef": True},
    }
    deployment = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": workload, "namespace": NAMESPACE, "labels": {"app": name}},
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": name}},
            "template": {
                "metadata": {"labels": {"app": name}},
                "spec": {"containers": [{"name": "web", "image": "nginx:1.27"}]},
            },
        },
    }
    service = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": workload, "namespace": NAMESPACE, "labels": {"app": name}},
        "spec": {"selector": {"app": name}, "ports": [{"port": 80, "targetPort": 80}]},
    }
    try:
        for path, body in (
            ("/apis/app.k8s.io/v1beta1/namespaces/default/applications", application),
            ("/apis/apps/v1/namespaces/default/deployments", deployment),
            ("/api/v1/namespaces/default/services", service),
        ):
            status, response = api.request("POST", path, body)
            assert status in (200, 201), (status, response)

        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications/composing/{name}',
            wait_until="domcontentloaded",
        )
        expect(ui.page.locator('[data-ai-id="composed-app-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        ui.page.locator('[data-ai-id="composed-app-detail:delete"]').click()
        ui.page.locator('[data-ai-id="composed-app-detail:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="composed-app-detail:delete-confirm"]').click()
        expect(ui.page.locator('[data-ai-id="composed-app-detail:delete-confirm"]')).to_have_count(0, timeout=60_000)
        ui.page.wait_for_url("**/applications/composing", timeout=30_000)
        expect(ui.page.locator(f'[data-ai-row="{name}"]')).to_have_count(0, timeout=30_000)
        status, _ = api.request("GET", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
        assert status == 404, status
        screenshot(ui.page, "crd-app-deleted")
    finally:
        api.request("DELETE", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
        api.request("DELETE", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
