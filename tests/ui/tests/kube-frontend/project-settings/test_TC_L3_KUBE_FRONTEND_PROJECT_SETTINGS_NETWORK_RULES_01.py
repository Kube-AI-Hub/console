from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

POLICIES = "/apis/networking.k8s.io/v1/namespaces/{ns}/networkpolicies"
PANEL = '[data-ai-id="settings-network:rules"]'
EMPTY = '[data-ai-id="settings-network:rules:empty"]'


def _policies(ui, namespace: str) -> list[dict]:
    status, body = ui.api.request("GET", POLICIES.format(ns=namespace))
    assert status == 200, (namespace, status, body)
    return body.get("items") or []


def _pick_empty_namespace(ui) -> str:
    """A project with no policies, so the empty state and the created row are unambiguous."""
    for namespace in ("default", "spaces"):
        if not _policies(ui, namespace):
            return namespace
    return "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_NETWORK_RULES_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_RULES-01 网络隔离：规则视图。"""

    ui = project_settings_page
    assert ui.api is not None
    namespace = _pick_empty_namespace(ui)
    other = "spaces" if namespace == "default" else "default"
    name = f"tc-e2e-nrules{uuid4().int % 1_000_000}"
    initially_empty = not _policies(ui, namespace)

    try:
        ui.page.goto(ui.url("networkpolicies", namespace))
        surface = ui.page.locator('[data-ai-id="networkpolicies:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        panel = ui.page.locator(PANEL)
        expect(panel).to_be_visible(timeout=30_000)
        expect(panel).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        if initially_empty:
            expect(panel.locator(EMPTY)).to_be_visible()
            assert "还没有网络策略" in panel.locator(EMPTY).inner_text()

        # A policy that exercises every part of the rule rendering: two peers of
        # different kinds in one direction, multiple ports, and an endPort range.
        status, body = ui.api.request(
            "POST",
            POLICIES.format(ns=namespace),
            {
                "apiVersion": "networking.k8s.io/v1",
                "kind": "NetworkPolicy",
                "metadata": {"name": name, "namespace": namespace},
                "spec": {
                    "podSelector": {"matchLabels": {"app": "web"}},
                    "policyTypes": ["Ingress", "Egress"],
                    "ingress": [
                        {
                            "from": [
                                {"namespaceSelector": {"matchLabels": {"kubernetes.io/metadata.name": other}}},
                                {"ipBlock": {"cidr": "10.0.0.0/8", "except": ["10.0.1.0/24"]}},
                            ],
                            "ports": [
                                {"protocol": "TCP", "port": 80},
                                {"protocol": "UDP", "port": 53},
                            ],
                        }
                    ],
                    "egress": [
                        {
                            "to": [{"podSelector": {"matchLabels": {"role": "db"}}}],
                            "ports": [{"protocol": "TCP", "port": 5432, "endPort": 5433}],
                        }
                    ],
                },
            },
        )
        assert status in (200, 201), (status, body)

        # Reload rather than wait for a cache invalidation: the policy was created
        # outside the page's mutation path, and a refresh is what the reader would do.
        ui.page.goto(ui.url("networkpolicies", namespace))
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        expect(panel).to_be_visible(timeout=30_000)
        expect(panel).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        headers = [text.strip() for text in panel.locator("thead th").all_inner_texts() if text.strip()]
        assert headers == ["策略", "限制方向", "作用对象", "允许来源/去向", "端口"], headers

        rows = panel.locator(f'tbody tr[data-ai-id^="settings-network:rule:{name}/"]')
        expect(rows).to_have_count(2, timeout=30_000)
        ingress = panel.locator(f'[data-ai-id="settings-network:rule:{name}/0"]')
        egress = panel.locator(f'[data-ai-id="settings-network:rule:{name}/1"]')

        ingress_text = ingress.inner_text()
        assert "入站流量" in ingress_text, ingress_text
        assert "app=web" in ingress_text, ingress_text
        assert f"namespaceSelector: kubernetes.io/metadata.name={other}" in ingress_text, ingress_text
        assert "ipBlock: 10.0.0.0/8 except 10.0.1.0/24" in ingress_text, ingress_text
        assert "TCP/80, UDP/53" in ingress_text, ingress_text

        egress_text = egress.inner_text()
        assert "出站流量" in egress_text, egress_text
        assert "podSelector: role=db" in egress_text, egress_text
        assert "TCP/5432-5433" in egress_text, egress_text

        screenshot(ui.page, "network-rules")

        # Deleting the policy must bring the empty explanation back, not a stray row.
        ui.api.request("DELETE", POLICIES.format(ns=namespace) + "/" + name)
        if initially_empty:
            ui.page.goto(ui.url("networkpolicies", namespace))
            expect(surface).to_be_visible(timeout=30_000)
            expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
            expect(ui.page.locator(EMPTY)).to_be_visible(timeout=60_000)
            assert f"settings-network:rule:{name}/" not in ui.page.locator(PANEL).inner_text()
    finally:
        ui.api.request("DELETE", POLICIES.format(ns=namespace) + "/" + name)
