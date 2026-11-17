from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_07(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-07 添加 Ingress 路由。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdroute-{stamp}"
    workload = f"{name}-web"
    host = f"shop-{stamp}.example.test"
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
            "template": {"metadata": {"labels": {"app": name}}, "spec": {"containers": [{"name": "web", "image": "nginx:1.27", "ports": [{"containerPort": 80}]}]}},
        },
    }
    service = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": workload, "namespace": NAMESPACE, "labels": {"app": name}},
        "spec": {"selector": {"app": name}, "ports": [{"port": 80, "targetPort": 80}]},
    }
    ingress_name = ""
    try:
        for path, body in (
            ("/apis/app.k8s.io/v1beta1/namespaces/default/applications", app),
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
        ui.page.locator('[data-ai-id="composed-app-detail:add-route"]').click()
        expect(ui.page.locator('[data-ai-id="composed-app-route:dialog"]')).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="composed-app-route:host"]').fill(host)
        ui.page.locator('[data-ai-id="composed-app-route:path"]').fill("/")
        ui.page.locator('[data-ai-id="composed-app-route:submit"]').click()
        expect(ui.page.locator('[data-ai-id="composed-app-route:dialog"]')).to_have_count(0, timeout=60_000)
        expect(ui.page.locator('[data-ai-id^="composed-app-detail:ingress:"]')).to_have_count(1, timeout=60_000)

        status, body = api.request("GET", f"/apis/networking.k8s.io/v1/namespaces/{NAMESPACE}/ingresses?labelSelector=app%3D{name}")
        assert status == 200 and isinstance(body, dict), (status, body)
        items = body.get("items") or []
        assert len(items) == 1, items
        ingress = items[0]
        ingress_name = (ingress.get("metadata") or {}).get("name") or ""
        rules = (ingress.get("spec") or {}).get("rules") or []
        assert rules[0]["host"] == host, rules
        backend = rules[0]["http"]["paths"][0]["backend"]["service"]
        assert backend == {"name": workload, "port": {"number": 80}}, backend
        screenshot(ui.page, "crd-app-route")
    finally:
        if ingress_name:
            api.request("DELETE", f"/apis/networking.k8s.io/v1/namespaces/{NAMESPACE}/ingresses/{ingress_name}")
        api.request("DELETE", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
        api.request("DELETE", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
