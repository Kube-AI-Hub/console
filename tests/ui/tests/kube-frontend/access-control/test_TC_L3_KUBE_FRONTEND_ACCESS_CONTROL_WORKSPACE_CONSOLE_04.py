from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
IAM = "/kapis/iam.kubesphere.io/v1alpha2/workspaces/{ws}"


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_04(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04 租户(企业空间)控制台 · 用户组树。"""

    ui = access_control_page
    assert ui.api is not None

    workspaces = [
        (item.get("metadata") or {}).get("name")
        for item in (_read(ui, f"{WORKSPACES}?limit=-1").get("items") or [])
    ]
    candidates = [name for name in workspaces if name]
    if not candidates:
        pytest.skip("没有可用的租户(企业空间)")

    workspace = candidates[0]
    groups: list[dict] = []
    bindings: list[dict] = []
    for candidate in candidates:
        groups = _read(ui, f"{IAM.format(ws=candidate)}/groups?limit=-1").get("items") or []
        bindings = _read(ui, f"{IAM.format(ws=candidate)}/groupbindings?limit=-1").get("items") or []
        if groups:
            workspace = candidate
            break
    if not groups:
        groups = _read(ui, f"{IAM.format(ws=workspace)}/groups?limit=-1").get("items") or []
        bindings = _read(ui, f"{IAM.format(ws=workspace)}/groupbindings?limit=-1").get("items") or []

    expected_members: dict[str, int] = {}
    for binding in bindings:
        name = (binding.get("groupRef") or {}).get("name") or ""
        if name:
            expected_members[name] = expected_members.get(name, 0) + len(binding.get("users") or [])

    ui.user_groups_open(workspace)
    surface = ui.user_groups_surface()
    state = surface.get_attribute("data-ai-state")
    expect(ui.user_groups_create()).to_be_visible()
    nodes = surface.locator('[data-ai-id^="workspace-user-groups:tree-node:"]')
    if not groups:
        assert state == "empty", f"expected empty state, got {state}"
        expect(nodes).to_have_count(0)
        expect(surface).to_contain_text("还没有用户组")
    else:
        assert state == "ready", f"expected ready state, got {state}"
        expect(nodes).to_have_count(len(groups), timeout=30_000)
        rendered = nodes.evaluate_all(
            "els => els.map(e => ({ name: e.getAttribute('data-ai-row'), count: e.querySelector('.tabular-nums')?.textContent?.trim() }))"
        )
        for row in rendered:
            assert row["count"] == str(expected_members.get(row["name"], 0)), row

    sidebar = ui.page.locator("aside").first.inner_text()
    for entry in ("配额", "租户(企业空间)角色", "用户组"):
        assert entry in sidebar, sidebar[:300]

    screenshot(ui.page, "workspace-user-groups")
