from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui
IAM = "/kapis/iam.kubesphere.io/v1alpha2"
MEMBERS = f"{IAM}/namespaces/default/members"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_MEMBERS_03(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03 项目成员搜索、自我保护与批量移除。"""
    ui = project_settings_page
    assert ui.api is not None
    status, body = ui.api.request("GET", f"{IAM}/namespaces/default/roles?limit=-1")
    assert status == 200, body
    roles = [
        item["metadata"]["name"]
        for item in body.get("items", [])
        if not str(item["metadata"]["name"]).startswith("role-template-")
    ]
    assert roles, "需要可分配的项目角色"
    role_name = "viewer" if "viewer" in roles else roles[0]
    prefix = f"tc-e2e-pm-{uuid4().hex[:6]}"
    names = [f"{prefix}-a", f"{prefix}-b"]
    try:
        for name in names:
            status, body = ui.api.request("POST", f"{IAM}/users", {
                "apiVersion": "iam.kubesphere.io/v1alpha2", "kind": "User",
                "metadata": {"name": name, "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"}},
                "spec": {"email": f"{name}@example.invalid", "password": f"Aa@{uuid4().hex}"},
            })
            assert status in (200, 201), body
            status, body = ui.api.request("POST", MEMBERS, [{"username": name, "roleRef": role_name}])
            assert status in (200, 201), body
        ui.page.goto(
            f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/members"
        )
        surface = ui.page.locator('[data-ai-id="members:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        search = ui.page.locator('[data-ai-id="members:search"]')
        search.fill(prefix)
        for name in names:
            row = surface.locator(f'[data-ai-row="{name}"]')
            expect(row).to_be_visible(timeout=20_000)
            expect(row).to_contain_text(f"{name}@example.invalid")
        search.fill("")
        me = ui.page.evaluate("() => document.querySelector('[data-ai-id=\"shell:user-menu\"]')?.textContent || 'admin'")
        current = (me or "admin").strip().split()[0] or "admin"
        mine = surface.locator(f'[data-ai-row="{current}"]')
        if mine.count():
            expect(mine.locator('input[type="checkbox"]')).to_have_count(0)
            expect(mine.locator('button[aria-label="更多操作"]')).to_have_count(0)
        search.fill(prefix)
        for name in names:
            surface.locator(f'[data-ai-row="{name}"] input[type="checkbox"]').first.check()
        ui.page.locator('[data-ai-id="members:bulk-remove"]').click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="members:delete-confirm"]')).to_be_disabled()
        ui.page.locator('[data-ai-id="members:delete-input"]').fill("2")
        ui.page.locator('[data-ai-id="members:delete-confirm"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", f"{MEMBERS}?limit=-1")
        assert status == 200, body
        leftover = {item["metadata"]["name"] for item in body.get("items", [])}
        assert leftover.isdisjoint(names), leftover
        for name in names:
            status, body = ui.api.request("GET", f"{IAM}/users/{name}")
            assert status == 200 and body["metadata"]["name"] == name, body
        screenshot(ui.page, "project-members-search-bulk")
    finally:
        for name in names:
            ui.api.request("DELETE", f"{MEMBERS}/{name}")
            ui.api.request("DELETE", f"{IAM}/users/{name}")
