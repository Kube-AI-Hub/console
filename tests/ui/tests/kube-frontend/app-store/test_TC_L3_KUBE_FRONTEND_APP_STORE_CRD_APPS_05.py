from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACE = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_CRD_APPS_05(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-05 创建多组件自制应用。"""

    ui = workbench_page
    api = ui.api
    stamp = int(time.time() * 1000) % 1_000_000
    name = f"tc-e2e-crdmulti-{stamp}"
    workloads = [f"{name}-web", f"{name}-api"]
    try:
        ui.page.goto(
            f'{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/{NAMESPACE}/applications/composing',
            wait_until="domcontentloaded",
        )
        expect(ui.page.locator('[data-ai-id="composed-apps:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        ui.page.locator('[data-ai-id="composed-apps:create"]').click()
        expect(ui.page.locator('[data-ai-id="composed-apps:create-dialog"]')).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="composed-apps:create-name"]').fill(name)
        ui.page.locator('[data-ai-id="composed-apps:create-add-component"]').click()
        ui.page.locator('[data-ai-id="composed-apps:create-component-1"]').fill("api")
        ui.page.locator('[data-ai-id="composed-apps:create-image-1"]').fill("nginx:1.27")
        ui.page.locator('[data-ai-id="composed-apps:create-replicas-1"]').fill("1")
        ui.page.locator('[data-ai-id="composed-apps:create-port-1"]').fill("8080")
        ui.page.locator('[data-ai-id="composed-apps:create-submit"]').click()
        expect(ui.page.locator('[data-ai-id="composed-apps:create-dialog"]')).to_have_count(0, timeout=60_000)
        row = ui.page.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=60_000)
        text = row.inner_text()
        assert "工作负载 2" in text, text
        screenshot(ui.page, "crd-app-multi-created")

        status, app = api.request("GET", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
        assert status == 200, (status, app)
        for workload in workloads:
            status, dep = api.request("GET", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
            assert status == 200, (workload, status)
            assert ((dep.get("spec") or {}).get("selector") or {}).get("matchLabels") == {"app": name}
            status, service = api.request("GET", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
            assert status == 200, (workload, status)
            assert ((service.get("spec") or {}).get("selector")) == {"app": name}
    finally:
        for workload in workloads:
            api.request("DELETE", f"/api/v1/namespaces/{NAMESPACE}/services/{workload}")
            api.request("DELETE", f"/apis/apps/v1/namespaces/{NAMESPACE}/deployments/{workload}")
        api.request("DELETE", f"/apis/app.k8s.io/v1beta1/namespaces/{NAMESPACE}/applications/{name}")
