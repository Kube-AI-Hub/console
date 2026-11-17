from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_06(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-06 自制应用详情事件。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdevt-{stamp}"
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
    try:
        for path, body in (
            ("/apis/app.k8s.io/v1beta1/namespaces/default/applications", application),
            ("/apis/apps/v1/namespaces/default/deployments", deployment),
        ):
            status, response = api.request("POST", path, body)
            assert status in (200, 201), (status, response)

        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications/composing/{name}',
            wait_until="domcontentloaded",
        )
        expect(ui.page.locator('[data-ai-id="composed-app-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.locator('[data-ai-id="composed-app-detail:events"]')).to_be_visible(timeout=30_000)
        table = ui.page.locator('[data-ai-id="composed-app-detail:events-table"]')
        expect(table).to_be_visible(timeout=30_000)
        expect(table).to_contain_text(workload, timeout=30_000)
        screenshot(ui.page, "crd-app-events")
    finally:
        api.request("DELETE", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
