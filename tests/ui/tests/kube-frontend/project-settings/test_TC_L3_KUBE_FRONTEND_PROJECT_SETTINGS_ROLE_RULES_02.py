from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

ROLES = "/apis/rbac.authorization.k8s.io/v1/namespaces/default/roles"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_ROLE_RULES_02(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-02 项目角色：编辑权限。"""

    ui = project_settings_page
    assert ui.api is not None
    name = f"tc-e2e-pr{int(time.time() * 1000) % 1_000_000}"
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
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/default/roles")
        surface = ui.page.locator('[data-ai-id="roles:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        ui.page.locator('[data-ai-id="roles:search"]').last.fill(name)
        ui.page.wait_for_timeout(1000)
        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        actions = [text.strip() for text in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "编辑权限" in actions, actions
        ui.page.get_by_role("menuitem", name="编辑权限", exact=True).click()

        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        editor = dialog.locator("textarea")
        # The dialog opens first and loads the rules into it; an empty box would mean
        # the skeleton was replaced by nothing.
        expect(editor).to_have_value(" | pods | get", timeout=20_000)

        editor.fill(" | configmaps | get, list\napps | deployments | get, patch")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, body = ui.api.request("GET", f"{ROLES}/{name}")
        assert status == 200
        rules = body.get("rules") or []
        assert len(rules) == 2, rules
        # The core group is spelled `['']`, never `[]` — the apiserver rejects the latter.
        assert rules[0]["apiGroups"] == [""], rules
        assert rules[0]["resources"] == ["configmaps"], rules
        assert rules[0]["verbs"] == ["get", "list"], rules
        assert rules[1]["apiGroups"] == ["apps"], rules
        screenshot(ui.page, "project-role-permissions")
    finally:
        ui.api.request("DELETE", f"{ROLES}/{name}")
