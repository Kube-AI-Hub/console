from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_ROLE_RULES_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01 项目角色：详情列出权限规则。"""

    ui = project_settings_page
    # Skip objects other cases create: a `tc-e2e-` role may be deleted by its own case
    # while this one is looking for it, and the failure then reads as "the row is
    # missing" rather than "the row was never ours to use".
    candidates = [
        role for role in ui.list_roles()
        if role.get("rules") and not str(role.get("metadata", {}).get("name", "")).startswith("tc-e2e")
    ]
    if not candidates:
        pytest.skip("default 项目没有带规则的角色，无法核对规则表")

    target = candidates[0]["metadata"]["name"]
    expected = ui.role_rules(target)

    ui.open("roles")
    ui.wait_ready("roles")
    # Find the role by name: it may not be on the first page.
    ui.page.locator('[data-ai-id="roles:search"]').last.fill(target)
    ui.page.wait_for_timeout(1200)
    ui.wait_ready("roles")
    # The search is debounced and the list re-queries; reading rows before the request
    # lands reports the unfiltered page as "role not found".
    expect(ui.page.locator(f'[data-ai-id="roles:surface"] [data-ai-row="{target}"]')).to_be_visible(timeout=30_000)

    ui.open_row_action(target, "详情")
    expect(ui.dialog).to_be_visible()
    table = ui.dialog.locator('[data-ai-id="settings-role:rules"]')
    expect(table).to_be_visible()

    header = [t.strip() for t in table.locator("thead th").all_inner_texts()]
    assert header == ["API 组", "资源", "动作"], header
    assert table.locator("tbody tr").count() == len(expected), (table.locator("tbody tr").count(), len(expected))
    screenshot(ui.page, "project-settings-role-rules")