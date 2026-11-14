from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
ROLES = "/kapis/iam.kubesphere.io/v1alpha2/workspaces/{ws}/workspaceroles?limit=-1"
PAGE_SIZE = 20


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_03(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03 企业空间控制台 · 角色列表。"""

    ui = access_control_page
    assert ui.api is not None

    workspaces = [
        (item.get("metadata") or {}).get("name")
        for item in (_read(ui, f"{WORKSPACES}?limit=-1").get("items") or [])
    ]
    candidates = [name for name in workspaces if name]
    if not candidates:
        pytest.skip("没有可用的企业空间")

    # Prefer a workspace that actually has roles: the page must show the same objects the
    # workspace-scoped endpoint returns, and a workspace with none only proves the empty state.
    workspace = candidates[0]
    items: list[dict] = []
    for candidate in candidates:
        items = _read(ui, ROLES.format(ws=candidate)).get("items") or []
        if items:
            workspace = candidate
            break

    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/roles")
    surface = ui.page.locator('[data-ai-id="workspace-roles:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    state = surface.get_attribute("data-ai-state")
    rows = surface.locator("tbody tr[data-ai-row]")
    if not items:
        assert state == "empty", f"expected empty state, got {state}"
        expect(rows).to_have_count(0)
    else:
        assert state == "ready", f"expected ready state, got {state}"
        headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
        for expected_header in ("名称", "规则数", "创建时间"):
            assert expected_header in headers, headers
        expect(rows).to_have_count(min(len(items), PAGE_SIZE), timeout=30_000)
        # The rule count is the object's top-level `rules` length; assert it on the row of
        # a known role instead of assuming the server's ordering.
        expected = {
            (item.get("metadata") or {}).get("name"): len(item.get("rules") or [])
            for item in items
        }
        rendered = rows.evaluate_all(
            "els => els.map(e => ({ name: e.getAttribute('data-ai-row'), cells: Array.from(e.cells).map(c => c.innerText.trim()) }))"
        )
        for row in rendered:
            assert expected.get(row["name"]) is not None, row
            assert row["cells"][1] == str(expected[row["name"]]), row

    sidebar = ui.page.locator("aside").first.inner_text()
    for entry in ("配额", "企业空间角色", "用户组"):
        assert entry in sidebar, sidebar[:300]

    screenshot(ui.page, "workspace-roles")
