from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
REPOS = f"/kapis/openpitrix.io/v1/workspaces/{WS}/repos"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_WORKSPACE_REPOS_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-02 企业空间应用仓库：添加与移除。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = f"tc-e2e-repo-{uuid.uuid4().hex[:8]}"

    def repo_id() -> str:
        status, body = ui.api.request("GET", f"{REPOS}?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return ""
        for item in body.get("items") or []:
            if item.get("name") == name:
                return item.get("repo_id") or ""
        return ""

    try:
        # `ui.base` is the project URL; the workspace console lives at the app origin.
        origin = ui.base.split("/kube-frontend/")[0]
        ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/repos")
        surface = ui.page.locator('[data-ai-id="workspace-repos:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="workspace-repos:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="workspace-repos:create:name"]').fill(name)
        ui.page.locator('[data-ai-id="workspace-repos:create:url"]').fill("https://charts.kubesphere.io/stable")
        ui.page.locator('[data-ai-id="workspace-repos:create:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)

        created = repo_id()
        assert created, "仓库创建后接口未返回该仓库"
        expect(ui.page.locator(f'[data-ai-row="{created}"]')).to_be_visible(timeout=30_000)

        # Removing through the row action is the same path an administrator uses.
        row = ui.page.locator(f'[data-ai-row="{created}"]')
        row.get_by_role("button", name="更多操作").click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="workspace-repos:delete:confirm"]').click()
        expect(confirm).to_have_count(0, timeout=60_000)
        assert repo_id() == "", "仓库移除后接口仍返回该仓库"
        screenshot(ui.page, "workspace-repo-create")
    finally:
        existing = repo_id()
        if existing:
            ui.api.request("DELETE", f"{REPOS}/{existing}")
