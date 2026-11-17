from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACE = "system-workspace"
ROLES = f"/kapis/iam.kubesphere.io/v1alpha2/workspaces/{WORKSPACE}/workspaceroles"


def _unique(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000) % 1_000_000}"


def _get(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{ROLES}/{name}")
    if status == 404:
        return None
    assert status == 200, (status, body)
    return body if isinstance(body, dict) else None


def _annotations(body: dict) -> dict:
    return ((body.get("metadata") or {}).get("annotations") or {})


def _wait(api, name: str, predicate, attempts: int = 30) -> dict:
    body = None
    for _ in range(attempts):
        body = _get(api, name)
        if body is not None and predicate(body):
            return body
        time.sleep(1)
    assert body is not None, name
    return body


def _row_menu(ui, name: str):
    row = ui.page.locator(f'[data-ai-row="{name}"]')
    expect(row).to_be_visible(timeout=30_000)
    row.get_by_role("button", name="更多操作").click()
    return ui.page.locator('[role="menu"]')


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_11(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-11 企业空间角色写能力。"""

    ui = access_control_page
    assert ui.api is not None
    name = _unique("tc-e2e-wsrole")
    try:
        ui.page.goto(f'{ui.base_url}/kube-frontend/workspaces/{WORKSPACE}/roles', wait_until="domcontentloaded")
        surface = ui.page.locator('[data-ai-id="workspace-roles:surface"]')
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        # ---- create from two templates ----
        ui.page.locator('[data-ai-id="workspace-roles:create"]').click()
        dialog = ui.page.locator('[data-ai-id="workspace-roles:dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="workspace-roles:name"]').fill(name)
        ui.page.locator('[data-ai-id="workspace-roles:alias"]').fill(f"e2e-{name[-6:]}")
        for template in ("role-template-view-members", "role-template-view-roles"):
            ui.page.locator(f'[data-ai-id="workspace-roles:template:{template}"]').check()
        ui.page.locator('[data-ai-id="workspace-roles:submit"]').click()
        expect(dialog).to_have_count(0, timeout=30_000)
        created = _wait(
            api=ui.api,
            name=name,
            predicate=lambda body: len(body.get("rules") or []) > 0,
        )
        assert len(created.get("rules") or []) > 0, created
        expected_templates = ["role-template-view-members", "role-template-view-roles"]
        aggregation = _annotations(created).get("iam.kubesphere.io/aggregation-roles")
        assert aggregation is not None, _annotations(created)
        assert all(template in aggregation for template in expected_templates), aggregation

        # ---- edit info via row action ----
        menu = _row_menu(ui, name)
        menu.get_by_role("menuitem", name="编辑信息").click()
        ui.page.locator('[data-ai-id="workspace-roles:edit-alias"]').fill(f"e2e2-{name[-6:]}")
        ui.page.locator('[data-ai-id="workspace-roles:edit-info-submit"]').click()
        expect(ui.page.locator('[data-ai-id="workspace-roles:edit-info-submit"]')).to_have_count(0, timeout=30_000)
        _wait(
            api=ui.api,
            name=name,
            predicate=lambda body: _annotations(body).get("kubesphere.io/alias-name") == f"e2e2-{name[-6:]}",
        )

        # ---- edit permissions: replace the template set ----
        menu = _row_menu(ui, name)
        menu.get_by_role("menuitem", name="编辑权限").click()
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="workspace-roles:template:role-template-view-members"]').uncheck()
        ui.page.locator('[data-ai-id="workspace-roles:template:role-template-manage-roles"]').check()
        ui.page.locator('[data-ai-id="workspace-roles:submit"]').click()
        expect(dialog).to_have_count(0, timeout=30_000)
        edited = _wait(
            api=ui.api,
            name=name,
            predicate=lambda body: "role-template-manage-roles" in _annotations(body).get("iam.kubesphere.io/aggregation-roles", ""),
        )
        aggregation = _annotations(edited).get("iam.kubesphere.io/aggregation-roles", "")
        assert "role-template-view-members" not in aggregation, aggregation

        # ---- platform-maintained role has no write actions ----
        # Template roles are not part of the plain workspace list on this deployment (the
        # kapis aggregate returns only the space's own roles); the preset system roles are
        # visible and carry creator=system, which is the same read-only rule.
        preset_row = ui.page.locator('[data-ai-row="system-workspace-admin"]')
        expect(preset_row).to_be_visible(timeout=20_000)
        expect(preset_row.get_by_role("button", name="更多操作")).to_have_count(0)

        # ---- delete with typed name ----
        menu = _row_menu(ui, name)
        menu.get_by_role("menuitem", name="删除").click()
        ui.page.locator('[data-ai-id="workspace-roles:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="workspace-roles:delete-confirm"]').click()
        expect(ui.page.locator('[data-ai-id="workspace-roles:delete-confirm"]')).to_have_count(0, timeout=30_000)
        assert _get(ui.api, name) is None
        screenshot(ui.page, "workspace-roles-writes")
    finally:
        status, _ = ui.api.request("DELETE", f"{ROLES}/{name}")
        assert status in (200, 404), status
