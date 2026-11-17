from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS_WRITE = "/apis/cluster.kubesphere.io/v1alpha1/clusters"
VALIDATION = "**/kapis/cluster.kubesphere.io/v1alpha1/clusters/validation"

KUBECONFIG = """apiVersion: v1
kind: Config
current-context: member
clusters:
- cluster:
    server: https://10.0.0.9:6443
    insecure-skip-tls-verify: true
  name: member
contexts:
- context:
    cluster: member
    user: member
  name: member
users:
- name: member
  user:
    token: dummy
"""


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ADD_CLUSTER_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03 添加集群：校验失败时在对话框展示原因。"""

    ui = cluster_management_page
    assert ui.api is not None
    name = f"tc-e2e-cl-{uuid.uuid4().hex[:6]}"

    ui.page.route(
        VALIDATION,
        lambda route: route.fulfill(
            status=400,
            content_type="text/plain; charset=utf-8",
            body=(
                "failed to validate member cluster configuration, err: "
                "hostcluster Jwt is not equal to member cluster jwt, "
                "please edit the member cluster cluster config"
            ),
        ),
    )

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    try:
        ui.page.locator('[data-ai-id="clusters:add"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        dialog.locator("#ai-field-cluster-name").fill(name)
        # The field is the shared CodeMirror editor: `fill()` is ignored and a bulk
        # insert reads as a paste the validator never sees.
        editor = dialog.locator(".cm-content").first
        expect(editor).to_be_visible(timeout=30_000)
        editor.click()
        ui.page.keyboard.press("ControlOrMeta+a")
        ui.page.keyboard.press("Delete")
        ui.page.keyboard.type(KUBECONFIG, delay=1)
        ui.page.locator('[data-ai-id="clusters:add-submit"]').click()

        banner = dialog.locator('[data-ai-id="clusters:add-error"]')
        expect(dialog).to_be_visible()
        expect(banner).to_be_visible(timeout=20_000)
        expect(banner).to_contain_text("jwtSecret")
        assert ui.api.request("GET", f"{CLUSTERS_WRITE}/{name}")[0] != 200, "校验失败的集群竟被创建"
        screenshot(ui.page, "cluster-add-error")
    finally:
        ui.api.request("DELETE", f"{CLUSTERS_WRITE}/{name}")
        ui.page.unroute(VALIDATION)
