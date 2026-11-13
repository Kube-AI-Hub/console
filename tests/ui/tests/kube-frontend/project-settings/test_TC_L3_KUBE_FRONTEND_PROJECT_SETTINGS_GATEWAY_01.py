from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

GATEWAYS = "/apis/gateway.kubesphere.io/v1alpha1/namespaces/default/gateways"


def _gateways(ui) -> list[dict]:
    status, body = ui.api.request("GET", GATEWAYS)
    if status != 200 or not isinstance(body, dict):
        return []
    return body.get("items") or []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_GATEWAY_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01 网关设置：无网关时创建并显示状态。"""

    ui = project_settings_page
    assert ui.api is not None

    existing = _gateways(ui)
    if existing:
        pytest.skip("default 项目已经有网关，空态不可复现")

    created: list[str] = []
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/default/gateways")
        surface = ui.page.locator('[data-ai-id="gateway:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        expect(ui.page.locator('[data-ai-id="gateway:empty"]')).to_be_visible()
        ui.page.locator('[data-ai-id="gateway:create"]').click()

        # The page flips to the info panel as soon as the object exists; readiness is the
        # controller's business and is reported separately.
        info = ui.page.locator('[data-ai-id="gateway:info"]')
        expect(info).to_be_visible(timeout=60_000)
        expect(ui.page.locator('[data-ai-id="gateway:name"]')).to_contain_text("kubesphere-router")

        objects = _gateways(ui)
        created = [item["metadata"]["name"] for item in objects]
        assert created, "gateway object was not created"

        # Either it is ready, or the controller told us why it is not — a bare "loading"
        # with no explanation would be the failure this asserts against.
        text = info.inner_text()
        assert "已就绪" in text or "部署中" in text, text
        screenshot(ui.page, "project-gateway")
    finally:
        for name in created or ["kubesphere-router-default"]:
            ui.api.request("DELETE", f"{GATEWAYS}/{name}")
