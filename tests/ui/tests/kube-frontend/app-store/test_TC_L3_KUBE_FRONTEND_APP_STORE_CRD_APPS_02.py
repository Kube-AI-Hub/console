from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_02(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02 创建自制应用。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdnew-{stamp}"
    workload = f"{name}-web"
    try:
        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications/composing',
            wait_until="domcontentloaded",
        )
        expect(ui.page.locator('[data-ai-id="composed-apps:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        ui.page.locator('[data-ai-id="composed-apps:create"]').click()
        dialog = ui.page.locator('[data-ai-id="composed-apps:create-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)

        # Local validation: an empty name must not send a request.
        ui.page.locator('[data-ai-id="composed-apps:create-submit"]').click()
        expect(ui.page.locator('[data-ai-id="composed-apps:create-error"]')).to_be_visible(timeout=10_000)

        ui.page.locator('[data-ai-id="composed-apps:create-name"]').fill(name)
        ui.page.locator('[data-ai-id="composed-apps:create-image"]').fill("nginx:1.27")
        ui.page.locator('[data-ai-id="composed-apps:create-replicas"]').fill("1")
        ui.page.locator('[data-ai-id="composed-apps:create-port"]').fill("80")
        ui.page.locator('[data-ai-id="composed-apps:create-submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)
        row = ui.page.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=60_000)
        text = row.inner_text()
        assert "工作负载 1" in text, text
        screenshot(ui.page, "crd-app-created")

        status, app = api.request("GET", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
        assert status == 200 and isinstance(app, dict), (status, app)
        selector = ((app.get("spec") or {}).get("selector") or {}).get("matchLabels") or {}
        assert selector == {"app": name}, selector
        status, dep = api.request("GET", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        assert status == 200, (status, dep)
        assert ((dep.get("spec") or {}).get("selector") or {}).get("matchLabels") == {"app": name}
        assert ((dep.get("spec") or {}).get("template") or {}).get("metadata", {}).get("labels") == {"app": name}
        status, service = api.request("GET", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
        assert status == 200, (status, service)
        assert ((service.get("spec") or {}).get("selector")) == {"app": name}

        ui.page.locator(f'[data-ai-id="composed-apps:name:{name}"]').click()
        ui.page.wait_for_url(f"**/applications/composing/{name}", timeout=30_000)
        expect(ui.page.locator(f'[data-ai-id="composed-app-detail:workload:{workload}"]')).to_be_visible(timeout=60_000)
    finally:
        api.request("DELETE", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
        api.request("DELETE", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
