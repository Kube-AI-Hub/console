from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1"
OPENPITRIX = "/kapis/openpitrix.io/v1/workspaces/{ws}"


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_WORKSPACE_REPOS_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-01 企业空间应用仓库 · 仓库与仓库应用。"""

    ui = access_control_page
    assert ui.api is not None

    workspaces = [
        (item.get("metadata") or {}).get("name")
        for item in (_read(ui, WORKSPACES).get("items") or [])
    ]
    candidates = [name for name in workspaces if name]
    if not candidates:
        pytest.skip("没有可用的企业空间")

    # Prefer a workspace that actually has a repository: the empty state is verified by the
    # same branch when none does, and the data branch is what needs a real object.
    workspace = candidates[0]
    repos: list[dict] = []
    for candidate in candidates:
        repos = _read(ui, OPENPITRIX.format(ws=candidate) + "/repos").get("items") or []
        if repos:
            workspace = candidate
            break
    if not repos:
        repos = _read(ui, OPENPITRIX.format(ws=workspace) + "/repos").get("items") or []
    apps = _read(ui, OPENPITRIX.format(ws=workspace) + "/apps?limit=-1").get("items") or []

    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/repos")
    repos_surface = ui.page.locator('[data-ai-id="workspace-repos:surface"]').last
    expect(repos_surface).to_be_visible(timeout=30_000)
    expect(repos_surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    repos_state = repos_surface.get_attribute("data-ai-state")
    if repos:
        assert repos_state == "ready", f"expected ready, got {repos_state}"
        headers = [value.strip() for value in repos_surface.locator("thead th:visible").all_inner_texts() if value.strip()]
        for expected_header in ("名称", "地址", "类型", "状态", "创建时间"):
            assert expected_header in headers, headers
        expect(repos_surface.locator("tbody tr[data-ai-row]")).to_have_count(len(repos), timeout=30_000)
    else:
        assert repos_state == "empty", f"expected empty, got {repos_state}"
        assert "还没有应用仓库" in repos_surface.inner_text()

    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/apps")
    apps_surface = ui.page.locator('[data-ai-id="workspace-apps:surface"]').last
    expect(apps_surface).to_be_visible(timeout=30_000)
    expect(apps_surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    apps_state = apps_surface.get_attribute("data-ai-state")
    if apps:
        assert apps_state == "ready", f"expected ready, got {apps_state}"
        headers = [value.strip() for value in apps_surface.locator("thead th:visible").all_inner_texts() if value.strip()]
        for expected_header in ("名称", "版本类型", "状态", "创建时间"):
            assert expected_header in headers, headers
        expect(apps_surface.locator("tbody tr[data-ai-row]")).to_have_count(len(apps), timeout=30_000)
    else:
        assert apps_state == "empty", f"expected empty, got {apps_state}"
        assert "还没有应用" in apps_surface.inner_text()

    sidebar = ui.page.locator("aside").first.inner_text()
    for entry in ("仓库列表", "仓库应用"):
        assert entry in sidebar, sidebar[:300]

    screenshot(ui.page, "workspace-app-repos")
