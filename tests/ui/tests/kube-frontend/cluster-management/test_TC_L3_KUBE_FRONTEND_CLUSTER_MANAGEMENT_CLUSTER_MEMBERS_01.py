from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MEMBERS = "/kapis/iam.kubesphere.io/v1alpha2/clustermembers"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_MEMBERS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-01 集群成员。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{MEMBERS}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取集群成员")
    items = body.get("items") or []
    if not items:
        pytest.skip("集群没有成员")

    first = items[0]
    username = first["metadata"]["name"]
    role = ((first["metadata"].get("annotations") or {})).get("iam.kubesphere.io/clusterrole") or ""

    # Not ui.open("members"): the URL segment and the surface id differ here, so the
    # generic helper would look for a surface that does not exist.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/members")
    surface = ui.page.locator('[data-ai-id="cluster-members:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    headers = [h.strip() for h in surface.locator("thead th:visible").all_inner_texts() if h.strip()]
    assert "用户名" in headers and "集群角色" in headers, headers

    expect(surface.locator("[data-ai-row]")).to_have_count(len(items), timeout=20_000)
    row = surface.locator(f'[data-ai-row="{username}"]')
    expect(row).to_be_visible(timeout=20_000)
    text = row.inner_text()
    assert username in text, text
    # Role is the reason this page exists: cluster-admin administers the cluster.
    if role:
        assert role in text, f"集群角色应为 {role}: {text}"

    screenshot(ui.page, "cluster-members")
