from __future__ import annotations

from uuid import uuid4

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

ROLES = "/apis/rbac.authorization.k8s.io/v1/namespaces/default/roles"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_ROLES_02(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02 项目角色：编辑信息与删除。"""

    ui = project_settings_page
    assert ui.api is not None
    name = f"tc-e2e-er{uuid4().int % 1_000_000}"
    status, _ = ui.api.request(
        "POST",
        ROLES,
        {
            "apiVersion": "rbac.authorization.k8s.io/v1",
            "kind": "Role",
            "metadata": {"name": name, "namespace": "default"},
            "rules": [{"apiGroups": [""], "resources": ["pods"], "verbs": ["get"]}],
        },
    )
    assert status in (200, 201), status
    try:
        ui.open("roles")
        ui.wait_ready("roles")
        ui.page.locator('[data-ai-id="roles:search"]').last.fill(name)
        ui.page.wait_for_timeout(900)
        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        actions = [text.strip() for text in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "编辑信息" in actions and "删除" in actions, actions

        ui.page.get_by_role("menuitem", name="编辑信息", exact=True).click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        # The edit-info dialog labels its inputs rather than giving them ids, so the
        # field is located by its label.
        dialog.get_by_label("别名").fill("界面别名")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, body = ui.api.request("GET", f"{ROLES}/{name}")
        assert status == 200
        assert ((body.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name") == "界面别名"

        ui.page.locator('[data-ai-id="roles:search"]').last.fill(name)
        ui.page.wait_for_timeout(900)
        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        ui.page.locator('[data-ai-id="roles:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="roles:delete-confirm"]').click()
        ui.page.wait_for_timeout(3000)

        status, _ = ui.api.request("GET", f"{ROLES}/{name}")
        assert status == 404, status
        screenshot(ui.page, "project-role-edit-delete")
    finally:
        ui.api.request("DELETE", f"{ROLES}/{name}")
