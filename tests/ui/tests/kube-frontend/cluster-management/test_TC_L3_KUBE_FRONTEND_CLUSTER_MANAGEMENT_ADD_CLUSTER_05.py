from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SSAR = "**/apis/authorization.k8s.io/v1/selfsubjectaccessreviews"
CLUSTERS_WRITE = "/apis/cluster.kubesphere.io/v1alpha1/clusters"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ADD_CLUSTER_05(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05 无写权限时主操作禁用。"""

    ui = cluster_management_page
    assert ui.api is not None

    # Refuse only the cluster-create review; other reviews (if any) keep the real answer.
    def deny_create(route) -> None:
        body = route.request.post_data or ""
        allowed = not ("clusters" in body and "cluster.kubesphere.io" in body)
        route.fulfill(
            status=200,
            content_type="application/json",
            body=(
                '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview",'
                '"status":{"allowed":' + ("true" if allowed else "false") + "}}"
            ),
        )

    ui.page.route(SSAR, deny_create)
    created: list[str] = []
    ui.page.on(
        "request",
        lambda request: created.append(request.url)
        if request.method == "POST" and "/apis/cluster.kubesphere.io/v1alpha1/clusters" in request.url
        else None,
    )

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    add = ui.page.locator('[data-ai-id="clusters:add"]')
    expect(add).to_be_disabled(timeout=30_000)
    # The reason is on screen, not only in a tooltip.
    hint = ui.page.locator('[data-ai-id="clusters:add:disabled-hint"]')
    expect(hint).to_be_visible(timeout=20_000)
    expect(hint).to_contain_text("没有接入集群的权限")
    screenshot(ui.page, "cluster-add-no-permission")

    # Clicking a disabled button opens nothing and sends nothing.
    add.click(force=True)
    ui.page.wait_for_timeout(500)
    assert ui.page.get_by_role("dialog").count() == 0, "无权限时仍打开了对话框"
    assert created == [], created

    # The cluster list itself is unaffected: rows are still there.
    expect(surface.locator("[data-ai-row]").first).to_be_visible(timeout=30_000)
    assert ui.api.request("GET", f"{CLUSTERS_WRITE}/host")[0] == 200
