from __future__ import annotations

import json
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_09(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-09 详情链路追踪。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdtrace-{stamp}"
    workload = f"{name}-web"
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
        expect(ui.page.locator('[data-ai-id="composed-app-detail:tracing"]')).to_be_visible(timeout=30_000)
        empty = ui.page.locator('[data-ai-id="composed-app-detail:tracing-empty"]')
        unavailable = ui.page.locator('[data-ai-id="composed-app-detail:tracing-unavailable"]')
        for _ in range(30):
            if empty.is_visible() or unavailable.is_visible():
                break
            ui.page.wait_for_timeout(1000)
        assert empty.is_visible() or unavailable.is_visible()
        screenshot(ui.page, "crd-app-tracing")

        # Positive waterfall branch, independent of whether this deployment reports traces:
        # fulfill the traces endpoint with the documented shape and expand the trace.
        mock_trace = {
            "data": [
                {
                    "traceID": "aa1122334455",
                    "spans": [
                        {"spanID": "s1", "operationName": "GET /", "processID": "p1", "startTime": 1000000, "duration": 5000},
                        {"spanID": "s2", "operationName": "SELECT", "processID": "p1", "startTime": 1002000, "duration": 1000},
                    ],
                    "processes": {"p1": {"serviceName": workload}},
                }
            ],
            "total": 1,
        }
        ui.page.route("**/services/*/traces**", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(mock_trace)))
        ui.page.reload(wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="composed-app-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.locator('[data-ai-id="composed-app-detail:tracing-table"]')).to_be_visible(timeout=30_000)
        ui.page.locator('[data-ai-id="composed-app-detail:trace-toggle:aa1122334455"]').click()
        expect(ui.page.locator('[data-ai-id="composed-app-detail:trace-span:s1"]')).to_be_visible(timeout=10_000)
        expect(ui.page.locator('[data-ai-id="composed-app-detail:trace-span:s2"]')).to_be_visible(timeout=10_000)
        screenshot(ui.page, "crd-app-tracing-spans")
        ui.page.unroute("**/services/*/traces**")
    finally:
        api.request("DELETE", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
        api.request("DELETE", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
