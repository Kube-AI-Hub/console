from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

POLICIES = "/apis/networking.k8s.io/v1/namespaces/default/networkpolicies"


def _add_rule(page, group: str, kind: str | None = None) -> str:
    page.locator(f'[data-ai-id="networkpolicies-create:{group}-add"]').click()
    row = page.locator(f'[data-ai-id="networkpolicies-create:{group}"] [data-ai-row^="{group}-"]').last
    expect(row).to_be_visible(timeout=10_000)
    row_id = (row.get_attribute("data-ai-row") or "").split("-")[-1]
    if kind:
        page.locator(f'[data-ai-id="networkpolicies-create:{group}-kind:{row_id}"]').click()
        page.get_by_role("option", name=kind, exact=True).click()
    return row_id


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_NETWORK_ISOLATION_04(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-04 白名单向导（多规则、对端与端口）。"""

    ui = project_settings_page
    assert ui.api is not None
    name = f"tc-e2e-npw{uuid4().int % 1_000_000}"

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies")
        surface = ui.page.locator('[data-ai-id="networkpolicies:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        ui.page.locator('[data-ai-id="networkpolicies:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        submit = ui.page.locator('[data-ai-id="networkpolicies-create:submit"]')
        # A whitelist with no rules admits nothing, so it cannot be saved.
        expect(submit).to_be_disabled(timeout=10_000)

        ui.page.locator('[data-ai-id="networkpolicies-create:name"]').fill(name)
        ui.page.locator('[data-ai-id="networkpolicies-create:description"]').fill("e2e whitelist")
        ui.page.locator('[data-ai-id="networkpolicies-create:pod-selector"]').fill("app=backend")

        pod_rule = _add_rule(ui.page, "ingress")
        ui.page.locator(f'[data-ai-id="networkpolicies-create:ingress-value:{pod_rule}"]').fill("tier=frontend")
        ui.page.locator(f'[data-ai-id="networkpolicies-create:ingress-port:{pod_rule}"]').fill("8080")

        block_rule = _add_rule(ui.page, "ingress", "IP 段")
        ui.page.locator(f'[data-ai-id="networkpolicies-create:ingress-value:{block_rule}"]').fill("10.0.0.0/8")

        egress_rule = _add_rule(ui.page, "egress", "项目（命名空间）")
        ui.page.locator(f'[data-ai-id="networkpolicies-create:egress-value:{egress_rule}"]').fill("default")

        expect(submit).to_be_enabled(timeout=10_000)
        screenshot(ui.page, "network-policy-wizard")
        submit.click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, body = ui.api.request("GET", f"{POLICIES}/{name}")
        assert status == 200, (status, body)
        spec = body.get("spec") or {}
        assert spec.get("podSelector", {}).get("matchLabels") == {"app": "backend"}, spec
        assert spec.get("policyTypes") == ["Ingress", "Egress"], spec
        ingress = spec.get("ingress") or []
        assert len(ingress) == 2, ingress
        assert ingress[0]["from"][0]["podSelector"]["matchLabels"] == {"tier": "frontend"}, ingress
        assert ingress[0].get("ports") == [{"protocol": "TCP", "port": 8080}], ingress
        assert ingress[1]["from"][0]["ipBlock"]["cidr"] == "10.0.0.0/8", ingress
        egress = spec.get("egress") or []
        assert len(egress) == 1, egress
        assert egress[0]["to"][0]["namespaceSelector"]["matchLabels"] == {
            "kubernetes.io/metadata.name": "default"
        }, egress
        annotations = (body.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/description") == "e2e whitelist", annotations
    finally:
        ui.api.request("DELETE", f"{POLICIES}/{name}")
