from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _clusters(api) -> list[str]:
    status, body = api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/clusters")
    assert status == 200 and isinstance(body, dict), (status, body)
    return [str((item.get("metadata") or {}).get("name") or "") for item in body.get("items") or []]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ROLES_02(platform_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02 平台角色页多集群切换。"""

    ui = platform_settings_page
    names = _clusters(ui.api)
    members = [name for name in names if name and name != "host"]
    assert members, f"multi-cluster deployment required, got {names}"
    member = members[0]
    status, body = ui.api.request("GET", f"/kapis/clusters/{member}/iam.kubesphere.io/v1alpha2/clusterroles?limit=-1")
    assert status == 200 and isinstance(body, dict), (status, body)
    member_roles = [str((item.get("metadata") or {}).get("name") or "") for item in body.get("items") or []]
    assert member_roles, "member cluster should expose cluster roles"

    ui.page.goto(f'{ui.base_url}/kube-frontend/access/clusterroles', wait_until="domcontentloaded")
    selector = ui.page.locator('[data-ai-id="clusterroles:cluster"]')
    expect(selector).to_be_visible(timeout=90_000)
    options = selector.locator("option").all_inner_texts()
    assert "host" in options and member in options, options

    selector.select_option(member)
    expect(ui.page.locator('[data-ai-id="clusterroles:member-readonly"]')).to_be_visible(timeout=30_000)
    surface = ui.page.locator('[data-ai-id="cluster-roles:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    expect(ui.page.locator('[data-ai-id="clusterroles:create"]')).to_have_count(0)
    # The cluster-scoped list is client-paginated; assert the first API role is rendered.
    expect(ui.page.locator(f'[data-ai-row="{member_roles[0]}"]')).to_be_visible(timeout=30_000)
    screenshot(ui.page, "platform-roles-member")

    selector.select_option("host")
    expect(ui.page.locator('[data-ai-id="clusterroles:create"]')).to_be_visible(timeout=30_000)
    expect(ui.page.locator('[data-ai-id="clusterroles:surface"]')).to_be_visible(timeout=30_000)
    screenshot(ui.page, "platform-roles-host")
