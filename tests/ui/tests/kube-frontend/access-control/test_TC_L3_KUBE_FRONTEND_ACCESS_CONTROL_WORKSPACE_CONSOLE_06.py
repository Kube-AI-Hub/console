from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
IAM = "/kapis/iam.kubesphere.io/v1alpha2"


def _cleanup_group(ui, workspace: str, prefix: str) -> None:
    status, body = ui.api.request("GET", f"{IAM}/workspaces/{workspace}/groups?limit=-1")
    if status != 200:
        return
    for item in body.get("items") or []:
        meta = item.get("metadata") or {}
        generate = str(meta.get("generateName") or "")
        name = str(meta.get("name") or "")
        if generate.startswith(prefix) or name.startswith(prefix):
            ui.api.request("DELETE", f"{IAM}/workspaces/{workspace}/groups/{name}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_06(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-06 租户(企业空间)控制台 · 用户组成员增删。"""
    ui = access_control_page
    assert ui.api is not None
    status, body = ui.api.request("GET", f"{WORKSPACES}?limit=-1")
    assert status == 200, body
    workspace = next((item["metadata"]["name"] for item in body.get("items", [])), None)
    assert workspace, "需要可用租户(企业空间)"
    status, body = ui.api.request("GET", f"{IAM}/workspaces/{workspace}/workspaceroles?limit=-1")
    assert status == 200, body
    roles = body.get("items") or []
    assert roles, "需要可分配的租户(企业空间)角色"
    role_name = roles[0]["metadata"]["name"]
    prefix = f"tc-e2e-ugm-{uuid4().hex[:6]}"
    group_name = f"{prefix}-g"
    username = f"{prefix}-u"
    groups = f"{IAM}/workspaces/{workspace}/groups"
    bindings = f"{IAM}/workspaces/{workspace}/groupbindings"

    try:
        status, body = ui.api.request("POST", f"{IAM}/users", {
            "apiVersion": "iam.kubesphere.io/v1alpha2", "kind": "User",
            "metadata": {"name": username, "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"}},
            "spec": {"email": f"{username}@example.invalid", "password": f"Aa@{uuid4().hex}"},
        })
        assert status in (200, 201), body
        status, body = ui.api.request("POST", groups, {
            "apiVersion": "iam.kubesphere.io/v1alpha2", "kind": "Group",
            "metadata": {
                "generateName": group_name,
                "labels": {"kubesphere.io/workspace": workspace},
                "annotations": {"kubesphere.io/workspace-role": role_name},
            },
        })
        assert status in (200, 201), body
        object_name = (body.get("metadata") or {}).get("name")
        if not object_name:
            listed = next(
                (
                    (item.get("metadata") or {}).get("name")
                    for item in (ui.api.request("GET", f"{groups}?limit=-1")[1].get("items") or [])
                    if (item.get("metadata") or {}).get("generateName") == group_name
                ),
                None,
            )
            object_name = listed
        assert object_name, "创建用户组后拿不到对象名"

        ui.user_groups_open(workspace)
        node = ui.user_groups_node(group_name)
        expect(node).to_be_visible(timeout=30_000)
        node.click()
        ui.page.locator('[data-ai-id="workspace-user-groups:add-member"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        ui.user_groups_field("username").fill(username)
        ui.user_groups_submit().click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        row = ui.user_groups_surface().locator(f'[data-ai-row="{username}"]')
        expect(row).to_be_visible(timeout=20_000)
        status, body = ui.api.request("GET", f"{bindings}?limit=-1")
        assert status == 200, body
        bound = [
            user
            for item in body.get("items") or []
            if (item.get("groupRef") or {}).get("name") == object_name
            for user in (item.get("users") or [])
        ]
        assert username in bound, bound

        row.get_by_role("button", name="更多操作").click()
        ui.page.get_by_role("menuitem", name="移除成员", exact=True).click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        ui.user_groups_confirmation("input").fill(username)
        ui.user_groups_confirmation("confirm").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        expect(row).to_have_count(0, timeout=20_000)
        status, body = ui.api.request("GET", f"{bindings}?limit=-1")
        assert status == 200, body
        bound = [
            user
            for item in body.get("items") or []
            if (item.get("groupRef") or {}).get("name") == object_name
            for user in (item.get("users") or [])
        ]
        assert username not in bound, bound
        status, body = ui.api.request("GET", f"{IAM}/users/{username}")
        assert status == 200 and body["metadata"]["name"] == username, body
        screenshot(ui.page, "workspace-user-groups-members")
    finally:
        _cleanup_group(ui, workspace, prefix)
        ui.api.request("DELETE", f"{IAM}/users/{username}")
