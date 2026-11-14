from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

IAM = "/kapis/iam.kubesphere.io/v1alpha2"
WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1"
ROLE_LABEL = "iam.kubesphere.io/workspacerole"


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_ROLE_DETAIL_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01 企业空间角色详情 · 规则明细与绑定成员数。"""

    ui = access_control_page
    assert ui.api is not None

    workspaces = [
        (item.get("metadata") or {}).get("name")
        for item in _read(ui, WORKSPACES).get("items") or []
    ]
    candidates = [name for name in workspaces if name]
    if not candidates:
        pytest.skip("没有可用的企业空间")

    # Prefer a workspace with a role that has rules: the rule table is the point of the page.
    workspace = None
    role: dict | None = None
    roles: list[dict] = []
    for candidate in candidates:
        roles = _read(ui, f"{IAM}/workspaces/{candidate}/workspaceroles?limit=-1").get("items") or []
        if not roles:
            continue
        workspace = candidate
        # The list page shows 20 roles per page; only the first page's roles are clickable.
        for item in roles[:20]:
            if item.get("rules"):
                role = item
                break
        if role is None:
            role = roles[0]
        break
    if workspace is None or role is None:
        pytest.skip("没有可读的企业空间角色")

    role_name = (role.get("metadata") or {}).get("name") or ""
    assert role_name, role
    detail = _read(ui, f"{IAM}/workspaces/{workspace}/workspaceroles/{role_name}")
    expected_rules = detail.get("rules") or []
    annotations = (detail.get("metadata") or {}).get("annotations") or {}
    display_name = annotations.get("kubesphere.io/alias-name") or role_name

    members = _read(ui, f"{IAM}/workspaces/{workspace}/workspacemembers?limit=-1").get("items") or []
    expected_members = [
        (member.get("metadata") or {}).get("name")
        for member in members
        if ((member.get("metadata") or {}).get("annotations") or {}).get(ROLE_LABEL) == role_name
    ]
    expected_members = [name for name in expected_members if name]

    # Enter the detail from the list, not by typing the URL: the link is part of the feature.
    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/roles")
    list_surface = ui.page.locator('[data-ai-id="workspace-roles:surface"]').last
    expect(list_surface).to_be_visible(timeout=30_000)
    expect(list_surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    ui.page.locator(f'[data-ai-id="workspace-roles:name:{role_name}"]').last.click()

    surface = ui.page.locator('[data-ai-id="workspace-role-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    assert surface.get_attribute("data-ai-state") == "ready"

    expect(ui.page.locator('[data-ai-id="workspace-role-detail:title"]').last).to_have_text(display_name)
    expect(ui.page.locator('[data-ai-id="workspace-role-detail:name"]').last).to_have_text(role_name)
    expect(ui.page.locator('[data-ai-id="workspace-role-detail:rule-count"]').last).to_have_text(str(len(expected_rules)))

    if expected_rules:
        rows = ui.page.locator('[data-ai-id="workspace-role-detail:rule-table"] tbody tr[data-ai-row]')
        expect(rows).to_have_count(len(expected_rules), timeout=30_000)
    else:
        expect(ui.page.locator('[data-ai-id="workspace-role-detail:empty-rules"]').last).to_be_visible(timeout=20_000)

    expect(ui.page.locator('[data-ai-id="workspace-role-detail:member-count"]').last).to_have_text(str(len(expected_members)))
    if expected_members:
        member_rows = ui.page.locator('[data-ai-id="workspace-role-detail:member-list"] [data-ai-row]')
        expect(member_rows).to_have_count(len(expected_members), timeout=30_000)
        rendered = member_rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
        assert sorted(str(value) for value in rendered) == sorted(expected_members)

    screenshot(ui.page, "workspace-role-detail")
