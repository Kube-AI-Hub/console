from __future__ import annotations

import base64
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/apis/cluster.kubesphere.io/v1alpha1/clusters"

# Structurally a kubeconfig, unreachable by design: the server parses it, fails to build a
# client, and answers with the reason. That reason is what the case asserts on.
UNREACHABLE = (
    "apiVersion: v1\n"
    "kind: Config\n"
    "clusters:\n"
    "- cluster:\n"
    "    server: https://127.0.0.1:1\n"
    "  name: e2e\n"
    "contexts: []\n"
    "current-context: e2e\n"
    "users: []\n"
)


def _kubeconfig(api, name: str) -> str | None:
    status, body = api.request("GET", f"{CLUSTERS}/{name}")
    if status != 200 or not isinstance(body, dict):
        return None
    return ((body.get("spec") or {}).get("connection") or {}).get("kubeconfig")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_LIST_04(cluster_fleet_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-04 集群列表：更新成员集群 kubeconfig。"""

    ui = cluster_fleet_page
    assert ui.api is not None
    name = f"tc-e2e-kc-{uuid.uuid4().hex[:6]}"
    original = base64.b64encode(b"apiVersion: v1").decode()

    created, _ = ui.api.request(
        "POST",
        CLUSTERS,
        {
            "apiVersion": "cluster.kubesphere.io/v1alpha1",
            "kind": "Cluster",
            "metadata": {"name": name},
            "spec": {
                "provider": "",
                "connection": {"type": "direct", "kubeconfig": original},
                "joinFederation": True,
            },
        },
    )
    assert created in (200, 201), created

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
        surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="更新 kubeconfig", exact=True).click()

        field = ui.page.locator('[data-ai-id="clusters:kubeconfig-input"]')
        expect(field).to_be_visible(timeout=20_000)

        # ---- structural check first: no round trip for the wrong document ----
        field.fill("not a kubeconfig")
        ui.page.locator('[data-ai-id="clusters:kubeconfig-submit"]').click()
        expect(ui.page.locator('[data-ai-id="clusters:kubeconfig-error"]')).to_be_visible(timeout=10_000)

        # ---- the server's own reason is what a reader can act on ----
        field.fill(UNREACHABLE)
        ui.page.locator('[data-ai-id="clusters:kubeconfig-submit"]').click()
        server_error = ui.page.locator('[data-ai-id="clusters:kubeconfig-server-error"]')
        expect(server_error).to_be_visible(timeout=60_000)
        text = server_error.inner_text()
        assert text.strip() and text.strip() != "Bad Request", (
            f"服务端原因被丢弃，只剩通用文案：{text!r}"
        )

        # ---- a rejected update must not half-write the object ----
        assert _kubeconfig(ui.api, name) == original, "校验失败后 kubeconfig 被改动"

        ui.page.locator('[data-ai-id="clusters:kubeconfig-cancel"]').click()

        # ---- proxy clusters have no kubeconfig to replace ----
        proxy = f"tc-e2e-px-{uuid.uuid4().hex[:6]}"
        created_proxy, _ = ui.api.request(
            "POST",
            CLUSTERS,
            {
                "apiVersion": "cluster.kubesphere.io/v1alpha1",
                "kind": "Cluster",
                "metadata": {"name": proxy},
                "spec": {"provider": "", "connection": {"type": "proxy"}, "joinFederation": True},
            },
        )
        assert created_proxy in (200, 201), created_proxy
        try:
            ui.page.reload()
            surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
            expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
            proxy_row = surface.locator(f'[data-ai-row="{proxy}"]')
            expect(proxy_row).to_be_visible(timeout=30_000)
            proxy_row.locator('button[aria-haspopup="menu"]').click()
            labels = [item.strip() for item in ui.page.get_by_role("menuitem").all_inner_texts()]
            assert "更新 kubeconfig" not in labels, labels
            ui.page.keyboard.press("Escape")
        finally:
            ui.api.request("DELETE", f"{CLUSTERS}/{proxy}")

        screenshot(ui.page, "cluster-list-kubeconfig")
    finally:
        ui.api.request("DELETE", f"{CLUSTERS}/{name}")
