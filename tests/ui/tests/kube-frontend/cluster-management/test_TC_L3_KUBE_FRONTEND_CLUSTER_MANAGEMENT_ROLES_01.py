from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _pick_role(api) -> str:
    status, body = api.request("GET", "/kapis/iam.kubesphere.io/v1alpha2/clusterroles?limit=20&sortBy=name")
    assert status == 200 and isinstance(body, dict), (status, body)
    for role in body.get("items") or []:
        if len(role.get("rules") or []) > 0:
            return str((role.get("metadata") or {}).get("name") or "")
    raise AssertionError("no cluster role with rules")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_ROLES_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01 集群作用域角色。"""

    ui = cluster_management_page
    role = _pick_role(ui.api)
    status, body = ui.api.request("GET", f"/kapis/iam.kubesphere.io/v1alpha2/clusterroles/{role}")
    assert status == 200 and isinstance(body, dict), (status, body)
    rule_count = len(body.get("rules") or [])
    status, users_body = ui.api.request("GET", f"/kapis/iam.kubesphere.io/v1alpha2/users?clusterrole={role}&limit=-1")
    assert status == 200 and isinstance(users_body, dict), (status, users_body)
    api_users = [str((item.get("metadata") or {}).get("name") or "") for item in users_body.get("items") or []]

    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/roles', wait_until="domcontentloaded")
    surface = ui.page.locator('[data-ai-id="cluster-roles:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    expect(ui.page.locator('[data-ai-id="cluster-roles:table"]')).to_be_visible(timeout=30_000)
    rows = ui.page.locator('[data-ai-row]')
    assert rows.count() > 0
    screenshot(ui.page, "cluster-roles-list")

    ui.page.goto(f'{ui.base_url}/kube-frontend/clusters/{ui.cluster}/roles/{role}', wait_until="domcontentloaded")
    detail = ui.page.locator('[data-ai-id="cluster-role-detail:surface"]')
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    expect(ui.page.locator('[data-ai-id="cluster-role-detail:rules"]')).to_be_visible(timeout=30_000)
    headers = ui.page.locator('[data-ai-id="cluster-role-detail:rules"] thead th').all_inner_texts()
    assert headers == ["API 组", "资源", "动作"], headers
    assert ui.page.locator('[data-ai-id^="cluster-role-detail:rule:"]').count() == rule_count
    screenshot(ui.page, "cluster-role-detail-rules")

    if rule_count == 0:
        expect(ui.page.locator('[data-ai-id="cluster-role-detail:rules-empty"]')).to_be_visible()

    ui.page.locator('[data-ai-id="cluster-role-detail:tab:users"]').click()
    if api_users:
        users_panel = ui.page.locator('[data-ai-id="cluster-role-detail:users"]')
        expect(users_panel).to_be_visible(timeout=30_000)
        for username in api_users:
            expect(ui.page.locator(f'[data-ai-id="cluster-role-detail:user:{username}"]')).to_be_visible(timeout=30_000)
    else:
        # Native Kubernetes bindings (system:* users, service accounts) are not IAM users;
        # an empty tab is the truthful answer for a role the platform has not granted.
        expect(ui.page.locator('[data-ai-id="cluster-role-detail:users-empty"]')).to_be_visible(timeout=30_000)
    screenshot(ui.page, "cluster-role-detail-users")
