from __future__ import annotations

import json
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MOCK_JOIN = {
    "command": "kubeadm join https://api.example.test:6443 --token abcdef.0123456789abcdef --discovery-token-ca-cert-hash sha256:0123456789abcdef",
    "token": "abcdef.0123456789abcdef",
    "server": "https://api.example.test:6443",
    "caCertHash": "sha256:0123456789abcdef",
    "expiresAt": "2026-11-19T00:00:00Z",
}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_12(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-12 节点添加（join 命令）。"""

    ui = cluster_management_page
    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes', wait_until="domcontentloaded")
    expect(ui.page.locator('[data-ai-id="nodes:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    # Permission gating (independent of the deployed backend): an explicit deny hides the
    # entry; fail-open is covered by the normal admin path below.
    ui.page.route(
        "**/kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews",
        lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"allowed": False, "reason": "viewer"})),
    )
    ui.page.reload(wait_until="domcontentloaded")
    expect(ui.page.locator('[data-ai-id="nodes:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    ui.page.wait_for_timeout(1500)
    assert ui.page.locator('[data-ai-id="nodes:add"]').count() == 0
    screenshot(ui.page, "node-add-hidden")
    ui.page.unroute("**/kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews")

    ui.page.reload(wait_until="domcontentloaded")
    expect(ui.page.locator('[data-ai-id="nodes:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    add = ui.page.locator('[data-ai-id="nodes:add"]')
    expect(add).to_be_visible(timeout=20_000)
    add.click()
    surface = ui.page.locator('[data-ai-id="node-add:surface"]')
    expect(surface).to_be_visible(timeout=20_000)
    command = ui.page.locator('[data-ai-id="node-add:command"]')
    error = ui.page.locator('[data-ai-id="node-add:error"]')
    for _ in range(30):
        if command.is_visible() or error.is_visible():
            break
        ui.page.wait_for_timeout(500)
    if command.is_visible():
        text = command.input_value()
        assert text.startswith("kubeadm join ")
        assert "--token " in text and "--discovery-token-ca-cert-hash sha256:" in text
        assert "token=" not in ui.page.url.lower()
        expect(ui.page.locator('[data-ai-id="node-add:copy"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="node-add:expires"]')).to_contain_text("有效期至")
    else:
        # B200 runs an older ks-apiserver: the endpoint is absent and the dialog must say so.
        assert error.is_visible()
        expect(error).to_contain_text("ks-apiserver")
        expect(ui.page.locator('[data-ai-id="node-add:retry"]')).to_be_visible()
        screenshot(ui.page, "node-add-unsupported")
        ui.page.locator('[data-ai-id="node-add:close"]').click()

        # Positive branch, independent of the deployed backend: fulfill the endpoint with
        # the documented response shape and verify the dialog renders it.
        def _fulfill(route):
            route.fulfill(status=200, content_type="application/json", body=json.dumps(MOCK_JOIN))

        ui.page.route("**/kapis/resources.kubesphere.io/v1alpha3/nodes/join-command**", _fulfill)
        add.click()
        expect(surface).to_be_visible(timeout=20_000)
        expect(command).to_be_visible(timeout=20_000)
        text = command.input_value()
        assert text == MOCK_JOIN["command"]
        expect(ui.page.locator('[data-ai-id="node-add:expires"]')).to_contain_text("有效期至")
        expect(ui.page.locator('[data-ai-id="node-add:copy"]')).to_be_visible()
        assert "token=" not in ui.page.url.lower()
        screenshot(ui.page, "node-add-command")
        ui.page.unroute("**/kapis/resources.kubesphere.io/v1alpha3/nodes/join-command**")
