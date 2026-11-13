from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
MEMBERS = "/kapis/iam.kubesphere.io/v1alpha2/workspaces/{workspace}/workspacemembers"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_DETAIL_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-02 企业空间详情：成员。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{WORKSPACES}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取企业空间列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("平台没有企业空间")
    name = items[0]["metadata"]["name"]

    status, members = ui.api.request("GET", MEMBERS.format(workspace=name) + "?limit=-1")
    if status != 200 or not isinstance(members, dict):
        pytest.skip("workspacemembers 接口不可用")
    member_items = members.get("items") or []

    ui.page.goto(f"{ui.base_url}/kube-frontend/access/workspaces/{name}")
    surface = ui.page.locator('[data-ai-id="workspace-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    block = ui.page.locator('[data-ai-id="workspace-detail:members"]')
    expect(block).to_contain_text(f"({len(member_items)})", timeout=30_000)
    rows = ui.page.locator('[data-ai-id="workspace-detail:member-list"] [data-ai-row]')
    if member_items:
        expect(rows).to_have_count(len(member_items), timeout=20_000)
        first = member_items[0]
        username = first["metadata"]["name"]
        role = ((first["metadata"].get("annotations") or {})).get("iam.kubesphere.io/workspacerole") or ""
        row_text = ui.page.locator(f'[data-ai-id="workspace-detail:member-list"] [data-ai-row="{username}"]').inner_text()
        assert username in row_text, row_text
        if role:
            assert role in row_text, f"角色应为 {role}: {row_text}"
    else:
        expect(block).to_contain_text("还没有成员", timeout=20_000)

    screenshot(ui.page, "workspace-detail-members")
