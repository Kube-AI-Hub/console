from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui
IAM = "/kapis/iam.kubesphere.io/v1alpha2"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_MEMBERS_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-02 成员列表搜索、自我保护与批量移除。"""
    ui = access_control_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1")
    assert status == 200, body
    workspace = None
    for item in body.get("items", []):
        candidate = item["metadata"]["name"]
        status, members_body = ui.api.request("GET", f"{IAM}/workspaces/{candidate}/workspacemembers?limit=-1")
        if status != 200:
            continue
        names_in_ws = {entry["metadata"]["name"] for entry in members_body.get("items", [])}
        if "admin" in names_in_ws:
            workspace = candidate
            break
    if not workspace:
        workspace = next((item["metadata"]["name"] for item in body.get("items", [])), None)
    assert workspace, "需要可用租户(企业空间)"
    members = f"{IAM}/workspaces/{workspace}/workspacemembers"
    status, body = ui.api.request("GET", f"{IAM}/workspaces/{workspace}/workspaceroles?limit=-1")
    assert status == 200, body
    roles = body.get("items", [])
    assert roles, "需要可分配的空间角色"
    role_name = roles[0]["metadata"]["name"]
    prefix = f"tc-e2e-wm-{uuid4().hex[:6]}"
    names = [f"{prefix}-a", f"{prefix}-b"]
    try:
        for name in names:
            status, body = ui.api.request("POST", f"{IAM}/users", {
                "apiVersion": "iam.kubesphere.io/v1alpha2", "kind": "User",
                "metadata": {"name": name, "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"}},
                "spec": {"email": f"{name}@example.invalid", "password": f"Aa@{uuid4().hex}"},
            })
            assert status in (200, 201), body
            status, body = ui.api.request("POST", members, [{"username": name, "roleRef": role_name}])
            assert status in (200, 201), body
        ui.page.goto(f"{ui.base_url}/kube-frontend/workspaces/{workspace}/members")
        surface = ui.page.locator('[data-ai-id="workspace-members:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        search = ui.page.locator('[data-ai-id="workspace-members:search"]')
        search.fill(prefix)
        for name in names:
            row = surface.locator(f'[data-ai-row="{name}"]')
            expect(row).to_be_visible(timeout=20_000)
            expect(row).to_contain_text(f"{name}@example.invalid")
        search.fill("")
        admin = surface.locator('[data-ai-row="admin"]')
        expect(admin).to_be_visible(timeout=20_000)
        expect(admin.locator('input[type="checkbox"]')).to_have_count(0)
        search.fill(prefix)
        for name in names:
            surface.locator(f'[data-ai-row="{name}"] input[type="checkbox"]').first.check()
        ui.page.locator('[data-ai-id="workspace-members:bulk-remove"]').click()
        expect(ui.workspace_member_confirmation("confirm")).to_be_disabled()
        ui.workspace_member_confirmation("input").fill("2")
        ui.workspace_member_confirmation("confirm").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", f"{members}?limit=-1")
        assert status == 200, body
        leftover = {item["metadata"]["name"] for item in body.get("items", [])}
        assert leftover.isdisjoint(names), leftover
        for name in names:
            status, body = ui.api.request("GET", f"{IAM}/users/{name}")
            assert status == 200 and body["metadata"]["name"] == name, body
        screenshot(ui.page, "workspace-members-search-bulk")
    finally:
        for name in names:
            ui.api.request("DELETE", f"{members}/{name}")
            ui.api.request("DELETE", f"{IAM}/users/{name}")
