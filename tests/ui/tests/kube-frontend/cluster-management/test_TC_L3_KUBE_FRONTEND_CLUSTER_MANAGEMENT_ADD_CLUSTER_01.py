from __future__ import annotations

import base64
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS_WRITE = "/apis/cluster.kubesphere.io/v1alpha1/clusters"

#: Complete but unreachable. The validation endpoint parses it and then fails to connect,
#: which is the realistic case: a kubeconfig that is well-formed but points nowhere.
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
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ADD_CLUSTER_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01 添加集群：导入 kubeconfig 并出现在列表。"""

    ui = cluster_management_page
    assert ui.api is not None
    name = f"tc-e2e-cl-{uuid.uuid4().hex[:6]}"

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    proxy_names: list[str] = []
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

        # A well-formed kubeconfig that cannot be reached is refused **before** the object
        # is created: the platform validates the connection first. Creating it anyway would
        # leave a cluster in the list that can never become ready.
        dialog.locator("#ai-field-cluster-kubeconfig").fill(KUBECONFIG)
        ui.page.locator('[data-ai-id="clusters:add-submit"]').click()
        expect(dialog).to_be_visible()
        expect(dialog.locator('[data-ai-id="clusters:add-error"]')).to_be_visible(timeout=60_000)
        assert ui.api.request("GET", f"{CLUSTERS_WRITE}/{name}")[0] != 200, "校验失败的集群竟被创建"
        ui.page.keyboard.press("Escape")
        ui.page.wait_for_timeout(500)

        # ---- 代理连接: no kubeconfig at all ----
        #
        # The two modes differ in exactly one visible way, and it is the one that decides
        # how the member cluster joins: a proxy cluster carries no kubeconfig, because the
        # agent dials out instead.
        proxy_name = f"tc-e2e-proxy-{uuid.uuid4().hex[:6]}"
        alias = f"成员集群-{uuid.uuid4().hex[:4]}"
        description = "created by the add-cluster case"
        proxy_names.append(proxy_name)
        ui.page.locator('[data-ai-id="clusters:add"]').click()
        proxy_dialog = ui.page.get_by_role("dialog")
        expect(proxy_dialog).to_be_visible(timeout=20_000)
        proxy_dialog.locator("#ai-field-cluster-name").fill(proxy_name)
        # Alias and description are collected up front, as the old console's basic-info step
        # does: they land as annotations, which is where every later page reads them from.
        proxy_dialog.locator("#ai-field-cluster-alias").fill(alias)
        proxy_dialog.locator("#ai-field-cluster-description").fill(description)
        proxy_dialog.locator('[data-ai-id="clusters:add-mode:proxy"]').check()
        # The kubeconfig field is gone in this mode; a leftover textarea would be a form
        # that collects something it will not send.
        expect(proxy_dialog.locator("#ai-field-cluster-kubeconfig")).to_have_count(0)
        expect(proxy_dialog.locator('[data-ai-id="clusters:add-proxy-tip"]')).to_be_visible()
        ui.page.locator('[data-ai-id="clusters:add-submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)

        proxy_status, proxy_body = ui.api.request("GET", f"{CLUSTERS_WRITE}/{proxy_name}")
        assert proxy_status == 200, (proxy_status, proxy_body)
        proxy_connection = ((proxy_body.get("spec") or {}).get("connection")) or {}
        assert proxy_connection.get("type") == "proxy", proxy_connection
        assert "kubeconfig" not in proxy_connection, proxy_connection
        annotations = (proxy_body.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == alias, annotations
        assert annotations.get("kubesphere.io/description") == description, annotations
        # The list shows the alias with the object name underneath, so both are visible.
        surface_after = ui.page.locator('[data-ai-id="clusters:surface"]').last
        row = surface_after.locator(f'[data-ai-row="{proxy_name}"]')
        expect(row).to_be_visible(timeout=30_000)
        assert alias in row.inner_text() and proxy_name in row.inner_text(), row.inner_text()[:160]
        screenshot(ui.page, "cluster-add")
    finally:
        # Unconditional: a half-finished import would sit in the fleet list as a cluster
        # that never becomes ready.
        ui.api.request("DELETE", f"{CLUSTERS_WRITE}/{name}")
        for proxy_name in proxy_names:
            ui.api.request("DELETE", f"{CLUSTERS_WRITE}/{proxy_name}")