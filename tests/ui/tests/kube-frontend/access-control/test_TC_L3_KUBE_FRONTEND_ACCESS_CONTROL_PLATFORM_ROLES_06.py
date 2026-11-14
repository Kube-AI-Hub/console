from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

ROLES = "/kapis/iam.kubesphere.io/v1alpha2/clusterroles"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_PLATFORM_ROLES_06(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-06 平台角色编辑器支持多条规则。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-role-{uuid.uuid4().hex[:8]}"
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/access/clusterroles")
        surface = ui.page.locator('[data-ai-id="clusterroles:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="clusterroles:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="role-editor:name"]').fill(name)

        # Rule 0 is the seeded one; make it "read pods".
        ui.page.locator('[data-ai-id="role-editor:rule:0:groups"]').fill("")
        ui.page.locator('[data-ai-id="role-editor:rule:0:resources"]').fill("pods")
        for verb in ("get", "list"):
            ui.page.locator(f'[data-ai-id="role-editor:rule:0:verb:{verb}"]').check()

        # Add rule 1: manage deployments and statefulsets in apps.
        ui.page.locator('[data-ai-id="role-editor:rule-add"]').click()
        ui.page.locator('[data-ai-id="role-editor:rule:1:groups"]').fill("apps")
        ui.page.locator('[data-ai-id="role-editor:rule:1:resources"]').fill("deployments, statefulsets")
        for verb in ("get", "list", "update"):
            ui.page.locator(f'[data-ai-id="role-editor:rule:1:verb:{verb}"]').check()

        ui.page.locator('[data-ai-id="role-editor:submit"]').click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, role = ui.api.request("GET", f"{ROLES}/{name}")
        assert status == 200, (status, role)
        rules = role.get("rules") or []
        assert len(rules) == 2, rules
        assert rules[0]["resources"] == ["pods"], rules[0]
        assert rules[0]["apiGroups"] == [""], rules[0]
        assert sorted(rules[0]["verbs"]) == ["get", "list"], rules[0]
        assert rules[1]["apiGroups"] == ["apps"], rules[1]
        assert sorted(rules[1]["resources"]) == ["deployments", "statefulsets"], rules[1]
        assert sorted(rules[1]["verbs"]) == ["get", "list", "update"], rules[1]

        # Editing must bring both rules back, not replace them with the default one: the
        # write path replaces the whole rule list.
        surface = ui.page.locator('[data-ai-id="clusterroles:surface"]').last
        ui.page.locator('[data-ai-id="clusterroles:search"]').fill(name)
        ui.page.wait_for_timeout(2_000)
        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=20_000)
        row.get_by_role("button", name="更多操作").click()
        ui.page.get_by_role("menuitem", name="编辑信息", exact=True).click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="role-editor:rule:1"]')).to_be_visible(timeout=20_000)
        assert ui.page.locator('[data-ai-id="role-editor:rule:1:resources"]').input_value().replace(" ", "") == "deployments,statefulsets".replace(" ", "")
        screenshot(ui.page, "platform-role-multi-rules")
        ui.page.get_by_role("dialog").get_by_role("button", name="取消", exact=True).click()
    finally:
        ui.api.request("DELETE", f"{ROLES}/{name}")
