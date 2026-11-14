from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui
IAM = "/kapis/iam.kubesphere.io/v1alpha2"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_MEMBERS_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01 空间成员写入闭环。"""
    ui = access_control_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1")
    assert status == 200, body
    workspace = next((item["metadata"]["name"] for item in body.get("items", [])), None)
    assert workspace, "需要可用企业空间"
    members = f"{IAM}/workspaces/{workspace}/workspacemembers"
    status, body = ui.api.request("GET", f"{IAM}/workspaces/{workspace}/workspaceroles?limit=-1")
    assert status == 200, body
    roles = body.get("items", [])
    assert len(roles) >= 2, "需要两个可分配的空间角色"
    name = f"tc-e2e-wsm-{uuid4().hex[:8]}"
    user_path = f"{IAM}/users/{name}"
    try:
        status, body = ui.api.request("POST", f"{IAM}/users", {
            "apiVersion": "iam.kubesphere.io/v1alpha2", "kind": "User",
            "metadata": {"name": name, "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"}},
            "spec": {"email": f"{name}@example.invalid", "password": f"Aa@{uuid4().hex}"},
        })
        assert status in (200, 201), body
        ui.page.goto(f"{ui.base_url}/kube-frontend/workspaces/{workspace}/members")
        ui.workspace_member_invite().click()
        ui.workspace_member_field("username").fill(name)
        for index, role in enumerate(roles[:2]):
            role_name = role["metadata"]["name"]
            label = role["metadata"].get("annotations", {}).get("kubesphere.io/alias-name") or role_name
            if index:
                ui.workspace_member_action(name, "修改角色")
                expect(ui.workspace_member_field("username")).to_be_disabled()
            ui.workspace_member_field("roleRef").click()
            ui.page.get_by_role("option", name=label, exact=True).click()
            ui.workspace_member_submit().click()
            expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
            expect(ui.workspace_member_row(name)).to_contain_text(role_name, timeout=30_000)
            status, body = ui.api.request("GET", f"{members}/{name}")
            assert status == 200, body
            assert body["metadata"]["annotations"]["iam.kubesphere.io/workspacerole"] == role_name
        ui.workspace_member_action(name, "移除成员")
        expect(ui.workspace_member_confirmation("confirm")).to_be_disabled()
        ui.workspace_member_confirmation("input").fill(name)
        ui.workspace_member_confirmation("confirm").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        expect(ui.workspace_member_row(name)).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", f"{members}?limit=-1")
        assert status == 200, body
        assert all(item["metadata"]["name"] != name for item in body.get("items", []))
        status, body = ui.api.request("GET", user_path)
        assert status == 200 and body["metadata"]["name"] == name, body
        for width in (1024, 1280, 1600):
            ui.page.set_viewport_size({"width": width, "height": 900})
            screenshot(ui.page, f"workspace-members-{width}")
    finally:
        ui.api.request("DELETE", f"{members}/{name}")
        ui.api.request("DELETE", user_path)
