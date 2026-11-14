from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
IAM = "/kapis/iam.kubesphere.io/v1alpha2"


def _groups(ui, workspace: str) -> list[dict]:
    status, body = ui.api.request("GET", f"{IAM}/workspaces/{workspace}/groups?limit=-1")
    assert status == 200, body
    return body.get("items") or []


def _cleanup(ui, workspace: str, prefix: str) -> None:
    for item in _groups(ui, workspace):
        meta = item.get("metadata") or {}
        generate = str(meta.get("generateName") or "")
        name = str(meta.get("name") or "")
        if generate.startswith(prefix) or name.startswith(prefix):
            ui.api.request("DELETE", f"{IAM}/workspaces/{workspace}/groups/{name}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_05(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-05 租户(企业空间)控制台 · 用户组创建、层级与删除。"""
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
    role = roles[0]
    role_name = role["metadata"]["name"]
    role_label = (role.get("metadata") or {}).get("annotations", {}).get("kubesphere.io/alias-name") or role_name
    prefix = f"tc-e2e-ug-{uuid4().hex[:6]}"
    parent_name = f"{prefix}-a"
    child_name = f"{prefix}-b"
    alias = f"{prefix}-alias"

    def create_group(name: str) -> None:
        ui.user_groups_create().click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        ui.user_groups_field("generateName").fill(name)
        ui.user_groups_field("workspaceRole").click()
        ui.page.get_by_role("option", name=role_label, exact=True).click()
        ui.user_groups_submit().click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        expect(ui.user_groups_node(name)).to_be_visible(timeout=30_000)

    try:
        ui.user_groups_open(workspace)
        create_group(parent_name)
        ui.user_groups_node(parent_name).click()
        create_group(child_name)
        expect(ui.user_groups_node(child_name)).to_have_attribute("data-ai-depth", "1")
        ui.user_groups_node(parent_name).click()
        ui.page.locator('[data-ai-id="workspace-user-groups:edit"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        expect(ui.user_groups_field("generateName")).to_be_disabled()
        ui.user_groups_field("alias").fill(alias)
        ui.user_groups_submit().click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        expect(ui.user_groups_node(parent_name)).to_contain_text(alias, timeout=20_000)

        ui.page.locator('[data-ai-id="workspace-user-groups:delete"]').click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        ui.user_groups_confirmation("input").fill(parent_name)
        ui.user_groups_confirmation("confirm").click()
        expect(confirm.get_by_role("alert")).to_contain_text("下级", timeout=10_000)
        ui.page.get_by_role("button", name="取消", exact=True).click()
        leftover = {
            str((item.get("metadata") or {}).get("generateName") or "")
            for item in _groups(ui, workspace)
        }
        assert parent_name in leftover and child_name in leftover, leftover

        ui.user_groups_node(child_name).click()
        ui.page.locator('[data-ai-id="workspace-user-groups:delete"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        ui.user_groups_confirmation("input").fill(child_name)
        ui.user_groups_confirmation("confirm").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        expect(ui.user_groups_node(child_name)).to_have_count(0, timeout=20_000)

        ui.user_groups_node(parent_name).click()
        ui.page.locator('[data-ai-id="workspace-user-groups:delete"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        ui.user_groups_confirmation("input").fill(parent_name)
        ui.user_groups_confirmation("confirm").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        expect(ui.user_groups_node(parent_name)).to_have_count(0, timeout=20_000)
        names = {
            str((item.get("metadata") or {}).get("generateName") or "")
            for item in _groups(ui, workspace)
        }
        assert names.isdisjoint({parent_name, child_name}), names
        screenshot(ui.page, "workspace-user-groups-write")
    finally:
        _cleanup(ui, workspace, prefix)
