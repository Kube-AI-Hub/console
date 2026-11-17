from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_08(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-08 详情流量治理。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdtraffic-{stamp}"
    application = {
        "apiVersion": "app.k8s.io/v1beta1",
        "kind": "Application",
        "metadata": {"name": name, "namespace": NAMESPACE, "labels": {"app.kubernetes.io/version": "v1"}},
        "spec": {"selector": {"matchLabels": {"app": name}}, "addOwnerRef": True},
    }
    try:
        status, response = api.request("POST", "/apis/app.k8s.io/v1beta1/namespaces/default/applications", application)
        assert status in (200, 201), (status, response)

        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications/composing/{name}',
            wait_until="domcontentloaded",
        )
        expect(ui.page.locator('[data-ai-id="composed-app-detail:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.locator('[data-ai-id="composed-app-detail:traffic"]')).to_be_visible(timeout=30_000)
        empty = ui.page.locator('[data-ai-id="composed-app-detail:traffic-empty"]')
        unavailable = ui.page.locator('[data-ai-id="composed-app-detail:traffic-unavailable"]')
        for _ in range(30):
            if empty.is_visible() or unavailable.is_visible():
                break
            ui.page.wait_for_timeout(1000)
        assert empty.is_visible() or unavailable.is_visible()
        screenshot(ui.page, "crd-app-traffic")
    finally:
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
