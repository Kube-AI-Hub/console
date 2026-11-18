from __future__ import annotations

import time
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

POLICIES = "/apis/networking.k8s.io/v1/namespaces/default/networkpolicies"


def _create(ui, name: str, spec: dict) -> str:
    body = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "NetworkPolicy",
        "metadata": {"name": name, "namespace": "default"},
        "spec": spec,
    }
    status, payload = ui._request("POST", POLICIES, body)
    assert status in (200, 201), f"创建网络策略 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _delete(ui, name: str) -> None:
    ui._request("DELETE", f"{POLICIES}/{quote(name)}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_NETWORK_RULES_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-02 网络策略详情：规则视图。"""

    ui = app_workloads_page
    assert ui.api is not None

    stamp = int(time.time()) % 100000
    both = f"tc-e2e-np-{stamp}-both"
    ingress_only = f"tc-e2e-np-{stamp}-ingress"
    _create(ui, both, {
        "podSelector": {"matchLabels": {"app": "web"}},
        "ingress": [
            {
                "from": [
                    {"namespaceSelector": {"matchLabels": {"env": "prod"}}, "podSelector": {"matchLabels": {"role": "frontend"}}},
                    {"ipBlock": {"cidr": "10.0.0.0/8", "except": ["10.1.0.0/16"]}},
                ],
                "ports": [{"protocol": "TCP", "port": 80}, {"protocol": "UDP", "port": 53}],
            }
        ],
        "egress": [{"to": [{"podSelector": {"matchLabels": {"app": "db"}}}], "ports": [{"protocol": "TCP", "port": 5432, "endPort": 5433}]}],
    })
    _create(ui, ingress_only, {"podSelector": {"matchLabels": {"app": "api"}}, "ingress": [{"from": [{"podSelector": {}}]}]})
    try:
        origin = ui.base.split("/kube-frontend/")[0]
        ui.page.goto(f"{origin}/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies/{both}")
        surface = ui.page.locator('[data-ai-id="networkpolicy-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        rules = ui.page.locator('[data-ai-id="networkpolicy-detail:rules"]')
        expect(rules).to_be_visible(timeout=30_000)
        assert "app=web" in rules.inner_text(), f"应显示作用对象：{rules.inner_text()[:200]}"

        ingress = ui.page.locator('[data-ai-id="networkpolicy-detail:rules:ingress"]')
        ingress_text = ingress.inner_text()
        assert "namespaceSelector: env=prod" in ingress_text and "podSelector: role=frontend" in ingress_text, ingress_text
        assert "ipBlock: 10.0.0.0/8 except 10.1.0.0/16" in ingress_text, ingress_text
        assert "TCP/80" in ingress_text and "UDP/53" in ingress_text, ingress_text
        assert ingress.locator("[data-ai-row]").count() == 1

        egress = ui.page.locator('[data-ai-id="networkpolicy-detail:rules:egress"]')
        egress_text = egress.inner_text()
        assert "podSelector: app=db" in egress_text and "TCP/5432-5433" in egress_text, egress_text
        screenshot(ui.page, "networkpolicy-detail-rules")

        # A policy with only ingress rules says so, instead of showing an empty table.
        ui.page.goto(f"{origin}/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies/{ingress_only}")
        expect(ui.page.locator('[data-ai-id="networkpolicy-detail:rules:egress:empty"]')).to_be_visible(timeout=60_000)
        assert "没有出站规则" in ui.page.locator('[data-ai-id="networkpolicy-detail:rules:egress:empty"]').inner_text()
        assert ui.page.locator('[data-ai-id="networkpolicy-detail:rules:egress:table"]').count() == 0
    finally:
        _delete(ui, both)
        _delete(ui, ingress_only)
