from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_ROLES_03(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-03 项目角色：模板角色只读。"""

    ui = project_settings_page
    roles = ui.list_roles()
    template = next((r for r in roles if r["metadata"]["name"].startswith("role-template-")), None)
    if template is None:
        pytest.skip("该项目没有 role-template-* 角色，无法验证只读")

    name = template["metadata"]["name"]
    ui.open("roles")
    ui.wait_ready("roles")
    ui.page.locator('[data-ai-id="roles:search"]').last.fill(name)
    ui.page.wait_for_timeout(900)

    row = ui.surface("roles").locator(f'[data-ai-row="{name}"]')
    # A template role exposes no menu entry beyond 详情; withholding the write actions
    # is better than offering them and failing with a permission error.
    expect(row.locator('button[aria-label="更多操作"]')).to_be_visible()
    row.locator('button[aria-label="更多操作"]').click()
    actions = [text.strip() for text in ui.page.get_by_role("menuitem").all_inner_texts()]
    assert "详情" in actions, actions
    for forbidden in ("编辑信息", "编辑权限", "删除"):
        assert forbidden not in actions, (forbidden, actions)
    screenshot(ui.page, "project-role-template-readonly")
