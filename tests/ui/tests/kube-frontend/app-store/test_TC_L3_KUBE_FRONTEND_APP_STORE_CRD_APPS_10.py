from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_10(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-10 详情灰度发布。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdgray-{stamp}"
    workload = f"{name}-web"
    strategy_name = f"tc-e2e-crdgray-strategy-{stamp}"
    app = {
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
            "template": {"metadata": {"labels": {"app": name}}, "spec": {"containers": [{"name": "web", "image": "nginx:1.27"}]}},
        },
    }
    service = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": workload, "namespace": NAMESPACE, "labels": {"app": name}},
        "spec": {"selector": {"app": name}, "ports": [{"port": 80, "targetPort": 80}]},
    }
    strategy = {
        "apiVersion": "servicemesh.kubesphere.io/v1alpha2",
        "kind": "Strategy",
        "metadata": {"name": strategy_name, "namespace": NAMESPACE},
        "spec": {
            "selector": {"matchLabels": {"app": name}},
            "template": {"spec": {"hosts": [workload], "http": [{"route": [{"destination": {"host": workload, "subset": "v2"}}]}]}},
        },
    }
    strategy_created = False
    try:
        for path, body in (
            ("/apis/app.k8s.io/v1beta1/namespaces/default/applications", app),
            ("/apis/apps/v1/namespaces/default/deployments", deployment),
            ("/api/v1/namespaces/default/services", service),
        ):
            status, response = api.request("POST", path, body)
            assert status in (200, 201), (status, response)
        status, response = api.request("POST", "/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/default/strategies", strategy)
        strategy_created = status in (200, 201)

        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications/composing/{name}',
            wait_until="domcontentloaded",
        )
        expect(ui.page.locator('[data-ai-id="composed-app-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.locator('[data-ai-id="composed-app-detail:gray"]')).to_be_visible(timeout=30_000)
        if strategy_created:
            expect(ui.page.locator(f'[data-ai-id="composed-app-detail:gray:{strategy_name}"]')).to_be_visible(timeout=30_000)
        else:
            empty = ui.page.locator('[data-ai-id="composed-app-detail:gray-empty"]')
            unavailable = ui.page.locator('[data-ai-id="composed-app-detail:gray-unavailable"]')
            for _ in range(20):
                if empty.is_visible() or unavailable.is_visible():
                    break
                ui.page.wait_for_timeout(1000)
            assert empty.is_visible() or unavailable.is_visible()
        screenshot(ui.page, "crd-app-gray")
        manage = ui.page.locator('[data-ai-id="composed-app-detail:gray-manage"]')
        expect(manage).to_be_visible()
        manage.click()
        ui.page.wait_for_url("**/grayrelease", timeout=30_000)
        expect(ui.page.locator('[data-ai-id="grayrelease:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    finally:
        if strategy_created:
            api.request("DELETE", f"/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/{NAMESPACE}/strategies/{strategy_name}")
        api.request("DELETE", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
        api.request("DELETE", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
