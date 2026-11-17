from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


def _apply(api, path: str, body: dict) -> None:
    status, response = api.request("POST", path, body)
    assert status in (200, 201, 409), (status, response)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_01(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01 自制应用列表。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    app = f"tc-e2e-crdapp-{stamp}"
    deployment = f"tc-e2e-crdapp-dep-{stamp}"
    application_body = {
        "apiVersion": "app.k8s.io/v1beta1",
        "kind": "Application",
        "metadata": {"name": app, "namespace": NAMESPACE, "labels": {"app.kubernetes.io/version": "v1"}},
        "spec": {"selector": {"matchLabels": {"app.kubernetes.io/version": "v1"}}, "addOwnerRef": True},
    }
    deployment_body = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": deployment, "namespace": NAMESPACE, "labels": {"app.kubernetes.io/version": "v1"}},
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app.kubernetes.io/version": "v1"}},
            "template": {
                "metadata": {"labels": {"app.kubernetes.io/version": "v1"}},
                "spec": {"containers": [{"name": "pause", "image": "registry.k8s.io/pause:3.9"}]},
            },
        },
    }
    try:
        _apply(api, "/apis/app.k8s.io/v1beta1/namespaces/default/applications", application_body)
        _apply(api, "/apis/apps/v1/namespaces/default/deployments", deployment_body)

        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications/composing',
            wait_until="domcontentloaded",
        )
        surface = ui.page.locator('[data-ai-id="composed-apps:surface"]')
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        row = ui.page.locator(f'[data-ai-row="{app}"]')
        expect(row).to_be_visible(timeout=30_000)
        text = row.inner_text()
        assert "v1" in text, text
        assert "工作负载 1" in text, text
        # The pod may not become Ready during the test; either health is a valid aggregate.
        assert "0/1" in text or "健康" in text, text
        screenshot(ui.page, "crd-apps-list")

        # Detail: the row opens the Application, whose matched components are listed.
        row.locator(f'[data-ai-id="composed-apps:name:{app}"]').click()
        ui.page.wait_for_url(f"**/applications/composing/{app}", timeout=30_000)
        detail = ui.page.locator('[data-ai-id="composed-app-detail:surface"]')
        expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        expect(ui.page.locator(f'[data-ai-id="composed-app-detail:workload:{deployment}"]')).to_be_visible(timeout=30_000)
        screenshot(ui.page, "crd-app-detail")

        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications',
            wait_until="domcontentloaded",
        )
        link = ui.page.locator('[data-ai-id="installed-apps:composed-link"]')
        expect(link).to_be_visible(timeout=90_000)
        link.click()
        ui.page.wait_for_url("**/applications/composing", timeout=30_000)
        expect(ui.page.locator('[data-ai-id="composed-apps:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    finally:
        api.request("DELETE", f"/apis/apps/v1/namespaces/default/deployments/{deployment}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/default/applications/{app}")
