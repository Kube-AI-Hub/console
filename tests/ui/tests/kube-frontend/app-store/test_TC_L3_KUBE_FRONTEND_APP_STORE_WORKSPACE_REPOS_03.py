from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
REPOS = f"/kapis/openpitrix.io/v1/workspaces/{WS}/repos"
CHART_REPO = "https://charts.kubesphere.io/stable"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_WORKSPACE_REPOS_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_REPOS-03 企业空间应用仓库：编辑、同步索引与事件详情。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = f"tc-e2e-repo-{uuid.uuid4().hex[:8]}"
    origin = ui.base.split("/kube-frontend/")[0]

    def find() -> dict:
        status, body = ui.api.request("GET", f"{REPOS}?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return {}
        for item in body.get("items") or []:
            if item.get("name") == name:
                return item
        return {}

    try:
        status, created = ui.api.request(
            "POST", REPOS, {"name": name, "url": CHART_REPO, "description": "e2e before edit"}
        )
        assert status == 200, f"create -> {status}: {created}"
        repo_id = (created or {}).get("repo_id") or ""
        assert repo_id, created

        ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/repos")
        surface = ui.page.locator('[data-ai-id="workspace-repos:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        expect(ui.page.locator(f'[data-ai-row="{repo_id}"]')).to_be_visible(timeout=30_000)

        # --- 编辑：描述与同步周期（PATCH 子集） ---
        row = ui.page.locator(f'[data-ai-row="{repo_id}"]')
        row.get_by_role("button", name="更多操作").click()
        ui.page.get_by_role("menuitem", name="编辑", exact=True).click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        description = ui.page.locator('[data-ai-id="workspace-repos:create:description"]')
        description.fill("e2e after edit")
        ui.page.locator('[data-ai-id="workspace-repos:create:sync-period"]').fill("600s")
        ui.page.locator('[data-ai-id="workspace-repos:create:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)

        status, detail = ui.api.request("GET", f"{REPOS}/{repo_id}")
        assert status == 200, f"get -> {status}: {detail}"
        assert detail.get("description") == "e2e after edit", detail
        assert detail.get("sync_period") == "600s", detail

        # --- 非法同步周期：客户端拦截，不发 PATCH ---
        patches: list[str] = []
        ui.page.on(
            "request",
            lambda request: patches.append(request.url)
            if request.method == "PATCH" and "/repos/" in request.url
            else None,
        )
        row.get_by_role("button", name="更多操作").click()
        ui.page.get_by_role("menuitem", name="编辑", exact=True).click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="workspace-repos:create:sync-period"]').fill("10s")
        ui.page.locator('[data-ai-id="workspace-repos:create:submit"]').click()
        expect(ui.page.locator('[data-ai-id="workspace-repos:create:error"]')).to_be_visible(timeout=20_000)
        assert patches == [], f"非法同步周期不应发 PATCH：{patches}"
        ui.page.get_by_role("dialog").get_by_role("button", name="取消").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        # --- 同步索引：POST action index ---
        indexed: list[str] = []
        ui.page.on(
            "request",
            lambda request: indexed.append(request.url)
            if request.method == "POST" and request.url.endswith(f"/repos/{repo_id}/action")
            else None,
        )
        row.get_by_role("button", name="更多操作").click()
        ui.page.get_by_role("menuitem", name="同步索引", exact=True).click()
        ui.page.wait_for_timeout(4000)
        assert indexed, "同步索引没有发出 POST …/repos/<id>/action"

        # --- 详情：基本信息 + 事件页签 ---
        status, events = ui.api.request("GET", f"{REPOS}/{repo_id}/events")
        assert status == 200, f"events -> {status}: {events}"
        event_items = (events or {}).get("items") or []

        ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/repos/{repo_id}")
        detail_surface = ui.page.locator('[data-ai-id="workspace-repo-detail:surface"]').last
        expect(detail_surface).to_be_visible(timeout=30_000)
        expect(ui.page.locator('[data-ai-id="workspace-repo-detail:name"]')).to_have_text(name, timeout=30_000)
        basic = ui.page.locator('[data-ai-id="workspace-repo-detail:basic"]')
        expect(basic).to_be_visible()
        assert CHART_REPO in basic.inner_text()
        ui.page.locator('[data-ai-id="workspace-repo-detail:tab:events"]').click()
        events_panel = ui.page.locator('[data-ai-id="workspace-repo-detail:events"]')
        expect(events_panel).to_be_visible(timeout=30_000)
        if event_items:
            expect(events_panel.locator("tbody tr[data-ai-row]")).to_have_count(len(event_items), timeout=30_000)
        else:
            assert "还没有同步事件" in events_panel.inner_text()
        screenshot(ui.page, "workspace-repo-detail")
    finally:
        current = find()
        if current.get("repo_id"):
            ui.api.request("DELETE", f"{REPOS}/{current['repo_id']}")
        assert find() == {}, "仓库清理后接口仍返回该对象"
