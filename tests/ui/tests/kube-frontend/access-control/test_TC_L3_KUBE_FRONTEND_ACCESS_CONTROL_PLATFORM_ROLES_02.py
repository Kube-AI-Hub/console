from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

RBAC = "/apis/rbac.authorization.k8s.io/v1/clusterroles"
IAM = "/kapis/iam.kubesphere.io/v1alpha2/clusterroles"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_PLATFORM_ROLES_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-02 平台角色：创建与删除。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-cr{int(time.time() * 1000) % 1_000_000}"
    try:
        ui.open("clusterroles")
        ui.wait_ready("clusterroles")
        ui.page.locator('[data-ai-id="clusterroles:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()

        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-alias").fill("界面角色")
        ui.page.locator("#ai-field-resources").fill("pods, services")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, body = ui.api.request("GET", f"{RBAC}/{name}")
        assert status == 200, (status, body)
        rules = body.get("rules") or []
        assert rules, "the created role has no rules"
        # An empty apiGroups field means the core group, which Kubernetes spells [''].
        assert rules[0].get("apiGroups") == [""], rules
        assert rules[0].get("resources") == ["pods", "services"], rules
        assert set(rules[0].get("verbs") or []) == {"get", "list", "watch"}, rules

        # A template role belongs to the platform: no edit or delete offered.
        #
        # The list is paginated and the search matches by name server-side, so try a few
        # real template names until one lands on screen — asserting on the first one
        # alphabetically would fail whenever it sorts onto another page.
        status, listed = ui.api.request("GET", f"{IAM}?limit=-1&name=role-template")
        templates = [i["metadata"]["name"] for i in (listed.get("items") or []) if i["metadata"]["name"].startswith("role-template-")]
        checked = False
        for template in templates[:5]:
            ui.page.locator('[data-ai-id="clusterroles:search"]').last.fill(template)
            ui.page.wait_for_timeout(900)
            row = ui.page.locator(f'[data-ai-row="{template}"]')
            if row.count() == 0:
                continue
            # A template role offers no actions at all, so the row has no menu button.
            # (Opening a menu and inspecting it would hang: there is no button to click.)
            assert row.locator('button[aria-label="更多操作"]').count() == 0, template
            checked = True
            break
        # With no template on the visible pages there is nothing to assert; say so
        # rather than pretending the check passed.
        assert checked or not templates, "no template role could be located in the list"
        screenshot(ui.page, "access-role-create")
    finally:
        ui.api.request("DELETE", f"{RBAC}/{name}")
