from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui
IAM = "/kapis/iam.kubesphere.io/v1alpha2"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_MEMBERS_03(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-03 成员详情属性与项目/DevOps 页签。"""
    ui = access_control_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1")
    assert status == 200, body
    workspace = next((item["metadata"]["name"] for item in body.get("items", [])), None)
    assert workspace, "需要可用租户(企业空间)"
    members = f"{IAM}/workspaces/{workspace}/workspacemembers"
    status, body = ui.api.request("GET", f"{IAM}/workspaces/{workspace}/workspaceroles?limit=-1")
    assert status == 200, body
    roles = body.get("items", [])
    assert roles, "需要可分配的空间角色"
    role_name = roles[0]["metadata"]["name"]
    name = f"tc-e2e-wmd-{uuid4().hex[:8]}"
    try:
        status, body = ui.api.request("POST", f"{IAM}/users", {
            "apiVersion": "iam.kubesphere.io/v1alpha2", "kind": "User",
            "metadata": {"name": name, "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"}},
            "spec": {"email": f"{name}@example.invalid", "password": f"Aa@{uuid4().hex}"},
        })
        assert status in (200, 201), body
        status, body = ui.api.request("POST", members, [{"username": name, "roleRef": role_name}])
        assert status in (200, 201), body
        ui.page.goto(f"{ui.base_url}/kube-frontend/workspaces/{workspace}/members/{name}")
        surface = ui.page.locator('[data-ai-id="workspace-member-detail:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "error")
        basic = ui.page.locator('[data-ai-id="workspace-member-detail:basic"]')
        expect(basic).to_contain_text("租户(企业空间)")
        expect(basic).to_contain_text("租户(企业空间)角色")
        expect(basic).to_contain_text(workspace)
        expect(basic).to_contain_text(role_name)
        expect(basic).to_contain_text(f"{name}@example.invalid")
        expect(ui.page.locator('[data-ai-id="workspace-member-detail:tab:projects"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="workspace-member-detail:projects"]')).to_be_visible()
        ui.page.locator('[data-ai-id="workspace-member-detail:tab:devops"]').click()
        expect(surface).not_to_have_attribute("data-ai-state", "error")
        expect(ui.page.locator('[data-ai-id="workspace-member-detail:devops"]')).to_be_visible(timeout=20_000)
        screenshot(ui.page, "workspace-member-detail")
    finally:
        ui.api.request("DELETE", f"{members}/{name}")
        ui.api.request("DELETE", f"{IAM}/users/{name}")
