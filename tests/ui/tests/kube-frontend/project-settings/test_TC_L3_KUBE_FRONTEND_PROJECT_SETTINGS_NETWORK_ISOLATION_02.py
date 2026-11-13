from __future__ import annotations

from uuid import uuid4

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

POLICIES = "/apis/networking.k8s.io/v1/namespaces/default/networkpolicies"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_NETWORK_ISOLATION_02(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02 网络隔离：创建与删除网络策略。"""

    ui = project_settings_page
    assert ui.api is not None
    name = f"tc-e2e-np{uuid4().int % 1_000_000}"
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies")
        surface = ui.page.locator('[data-ai-id="networkpolicies:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        ui.page.locator('[data-ai-id="networkpolicies:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-podSelector").fill("app=web")
        ui.page.locator("#ai-field-peerSelector").fill("role=frontend")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, body = ui.api.request("GET", f"{POLICIES}/{name}")
        assert status == 200, (status, body)
        spec = body.get("spec") or {}
        assert spec.get("podSelector", {}).get("matchLabels") == {"app": "web"}, spec
        # A peer wraps its selector: `from: [{ podSelector: {...} }]`, never the
        # selector itself — the latter is rejected with "must specify a peer".
        ingress = spec.get("ingress") or []
        assert ingress and ingress[0]["from"][0]["podSelector"]["matchLabels"] == {"role": "frontend"}, spec
        assert spec.get("policyTypes") == ["Ingress"], spec

        # Delete through the row action and confirm it is gone.
        ui.page.locator('[data-ai-id="networkpolicies:search"]').last.fill(name)
        ui.page.wait_for_timeout(900)
        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        ui.page.get_by_role("menuitem", name="删除网络策略", exact=True).click()
        ui.page.locator('[data-ai-id="networkpolicies:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="networkpolicies:delete-confirm"]').click()
        ui.page.wait_for_timeout(3000)
        status, _ = ui.api.request("GET", f"{POLICIES}/{name}")
        assert status == 404, status
        screenshot(ui.page, "network-policy-create")
    finally:
        ui.api.request("DELETE", f"{POLICIES}/{name}")
