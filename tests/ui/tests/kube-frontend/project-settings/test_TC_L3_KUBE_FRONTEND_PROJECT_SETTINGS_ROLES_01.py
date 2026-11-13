from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_ROLES_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01 项目角色：列表列与模板徽标。"""

    ui = project_settings_page
    roles = ui.list_roles()
    if not roles:
        pytest.skip("default 项目没有角色，无法核对列表")

    ui.open("roles")
    ui.wait_ready("roles")

    headers = ui.headers("roles")
    required = ["名称", "规则数", "创建时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    # The list is paginated; the templates are numerous, so prove the badge on a page
    # that actually contains one rather than assuming page 1 does.
    template = next((r for r in roles if r["metadata"]["name"].startswith("role-template-")), None)
    if template is None:
        pytest.skip("该项目没有 role-template-* 角色，无法验证模板徽标")

    ui.page.locator('[data-ai-id="roles:search"]').last.fill(template["metadata"]["name"])
    ui.page.wait_for_timeout(600)
    ui.wait_ready("roles")
    row = ui.surface("roles").locator(f'[data-ai-row="{template["metadata"]["name"]}"]')
    expect(row).to_be_visible()
    assert "模板" in row.inner_text(), row.inner_text()
    screenshot(ui.page, "project-settings-roles")
