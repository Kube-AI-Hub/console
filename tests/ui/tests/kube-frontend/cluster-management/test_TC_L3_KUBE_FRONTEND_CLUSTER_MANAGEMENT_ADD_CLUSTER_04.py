from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS_WRITE = "/apis/cluster.kubesphere.io/v1alpha1/clusters"
CHECK_EXIST = "**/kapis/cluster.kubesphere.io/v1alpha1/clusters/*"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ADD_CLUSTER_04(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04 名称预检：命中时提示且不阻止提交。"""

    ui = cluster_management_page
    assert ui.api is not None

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # `host` always exists: it is the cluster the console itself runs on.
    checked: list[str] = []
    ui.page.on(
        "request",
        lambda request: checked.append(request.url) if "/kapis/cluster.kubesphere.io/v1alpha1/clusters/" in request.url else None,
    )

    ui.page.locator('[data-ai-id="clusters:add"]').click()
    dialog = ui.page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=20_000)

    name = dialog.locator("#ai-field-cluster-name")
    name.fill("host")
    # Blur is what triggers the check; typing alone must not.
    name.press("Tab")
    error = dialog.locator('[data-ai-id="clusters:add-name-error"]')
    expect(error).to_contain_text("已经有同名集群", timeout=20_000)

    # The notice is advice, not a gate: submit stays available.
    expect(ui.page.locator('[data-ai-id="clusters:add-submit"]')).to_be_enabled()
    screenshot(ui.page, "cluster-add-name-taken")

    # One request per blur, not one per keystroke.
    checks_for_host = [url for url in checked if url.rstrip("/").endswith("/clusters/host")]
    assert len(checks_for_host) == 1, checks_for_host

    # A free name clears the notice.
    free_name = f"tc-e2e-free-{uuid.uuid4().hex[:6]}"
    name.fill(free_name)
    name.press("Tab")
    expect(error).to_have_count(0, timeout=20_000)

    # Nothing was created by the checks themselves.
    assert ui.api.request("GET", f"{CLUSTERS_WRITE}/{free_name}")[0] == 404, "预检竟然创建了集群"
    ui.page.keyboard.press("Escape")
