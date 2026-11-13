from __future__ import annotations

import base64
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS_WRITE = "/apis/cluster.kubesphere.io/v1alpha1/clusters"

KUBECONFIG = """apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://10.0.0.9:6443
  name: member
"""


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ADD_CLUSTER_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01 添加集群：导入 kubeconfig 并出现在列表。"""

    ui = cluster_management_page
    assert ui.api is not None
    name = f"tc-e2e-cl-{uuid.uuid4().hex[:6]}"

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    try:
        ui.page.locator('[data-ai-id="clusters:add"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)

        # Invalid input is refused before any request is made — the empty selectors are
        # deliberate: a request that never happens cannot be observed afterwards.
        dialog.locator("#ai-field-cluster-name").fill("Bad_Name")
        dialog.locator("#ai-field-cluster-kubeconfig").fill(KUBECONFIG)
        ui.page.locator('[data-ai-id="clusters:add-submit"]').click()
        expect(dialog).to_contain_text("名称只能包含", timeout=15_000)
        assert ui.api.request("GET", f"{CLUSTERS_WRITE}/{name}")[0] != 200, "非法名称竟创建了集群"

        dialog.locator("#ai-field-cluster-name").fill(name)
        dialog.locator("#ai-field-cluster-kubeconfig").fill("not a kubeconfig")
        ui.page.locator('[data-ai-id="clusters:add-submit"]').click()
        expect(dialog).to_contain_text("不像 kubeconfig", timeout=15_000)
        assert ui.api.request("GET", f"{CLUSTERS_WRITE}/{name}")[0] != 200, "非法内容竟创建了集群"

        dialog.locator("#ai-field-cluster-kubeconfig").fill(KUBECONFIG)
        ui.page.locator('[data-ai-id="clusters:add-submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        expect(surface.locator(f'[data-ai-row="{name}"]')).to_have_count(1, timeout=30_000)

        status, body = ui.api.request("GET", f"{CLUSTERS_WRITE}/{name}")
        assert status == 200, (status, body)
        connection = ((body.get("spec") or {}).get("connection")) or {}
        assert connection.get("type") == "direct", connection
        encoded = connection.get("kubeconfig") or ""
        # The field is base64 in the object; sending the YAML as-is creates a cluster that
        # never connects, which is what the old console's `safeBtoa` prevents.
        assert "apiVersion" in base64.b64decode(encoded).decode("utf-8", "ignore"), encoded[:40]
        assert (body.get("spec") or {}).get("joinFederation") is True, body.get("spec")
        screenshot(ui.page, "cluster-add")
    finally:
        # Unconditional: a half-finished import would sit in the fleet list as a cluster
        # that never becomes ready.
        ui.api.request("DELETE", f"{CLUSTERS_WRITE}/{name}")
