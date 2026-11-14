from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
IAM = "/kapis/iam.kubesphere.io/v1alpha2/workspaces/{ws}"
PAGE_SIZE = 20


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_04(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-04 企业空间控制台 · 用户组列表。"""

    ui = access_control_page
    assert ui.api is not None

    workspaces = [
        (item.get("metadata") or {}).get("name")
        for item in (_read(ui, f"{WORKSPACES}?limit=-1").get("items") or [])
    ]
    candidates = [name for name in workspaces if name]
    if not candidates:
        pytest.skip("没有可用的企业空间")

    # Prefer a workspace that has groups; a workspace with none still proves the empty state.
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

    # Members are not on the Group: sum the users of every binding that points at it, the
    # same join the page performs.
    expected_members: dict[str, int] = {}
    for binding in bindings:
        name = (binding.get("groupRef") or {}).get("name") or ""
        if name:
            expected_members[name] = expected_members.get(name, 0) + len(binding.get("users") or [])

    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/user-groups")
    surface = ui.page.locator('[data-ai-id="workspace-user-groups:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    state = surface.get_attribute("data-ai-state")
    rows = surface.locator("tbody tr[data-ai-row]")
    if not groups:
        assert state == "empty", f"expected empty state, got {state}"
        expect(rows).to_have_count(0)
    else:
        assert state == "ready", f"expected ready state, got {state}"
        headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
        for expected_header in ("名称", "成员", "描述"):
            assert expected_header in headers, headers
        expect(rows).to_have_count(min(len(groups), PAGE_SIZE), timeout=30_000)
        rendered = rows.evaluate_all(
            "els => els.map(e => ({ name: e.getAttribute('data-ai-row'), cells: Array.from(e.cells).map(c => c.innerText.trim()) }))"
        )
        for row in rendered:
            assert row["cells"][1] == str(expected_members.get(row["name"], 0)), row

    sidebar = ui.page.locator("aside").first.inner_text()
    for entry in ("配额", "企业空间角色", "用户组"):
        assert entry in sidebar, sidebar[:300]

    screenshot(ui.page, "workspace-user-groups")
