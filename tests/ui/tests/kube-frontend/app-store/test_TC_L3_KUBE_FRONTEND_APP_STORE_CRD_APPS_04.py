from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_04(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-04 编辑自制应用信息。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdedit-{stamp}"
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
        ui.page.locator('[data-ai-id="composed-app-detail:edit"]').click()
        ui.page.locator('[data-ai-id="composed-app-detail:edit-alias"]').fill("演示应用")
        ui.page.locator('[data-ai-id="composed-app-detail:edit-description"]').fill("由 E2E 编辑")
        ui.page.locator('[data-ai-id="composed-app-detail:edit-info-submit"]').click()
        expect(ui.page.locator('[data-ai-id="composed-app-detail:edit-info-submit"]')).to_have_count(0, timeout=30_000)
        expect(ui.page.locator('[data-ai-id="composed-app-detail:alias"]')).to_have_text("演示应用", timeout=30_000)

        status, body = api.request("GET", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
        assert status == 200 and isinstance(body, dict), (status, body)
        annotations = (body.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == "演示应用", annotations
        assert annotations.get("kubesphere.io/description") == "由 E2E 编辑", annotations
        screenshot(ui.page, "crd-app-edited")
    finally:
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
