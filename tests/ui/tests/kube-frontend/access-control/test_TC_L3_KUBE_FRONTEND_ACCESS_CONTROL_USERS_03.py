from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_03(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03 用户：修改平台角色与删除。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-ur{int(time.time() * 1000) % 1_000_000}"
    status, _ = ui.api.request(
        "POST",
        USERS,
        {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {"name": name, "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"}},
            "spec": {"email": f"{name}@example.com", "password": "Strong12345"},
        },
    )
    assert status in (200, 201), status
    try:
        ui.open("users")
        ui.wait_ready("users")
        ui.page.locator('[data-ai-id="users:search"]').last.fill(name)
        ui.page.wait_for_timeout(900)
        ui.wait_ready("users")

        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        actions = [t.strip() for t in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "修改平台角色" in actions and "删除" in actions, actions
        ui.page.get_by_role("menuitem", name="修改平台角色", exact=True).click()

        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        dialog.locator("[role=combobox]").first.click()
        ui.page.get_by_role("option", name="平台管理员").click()
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, body = ui.api.request("GET", f"{USERS}/{name}")
        assert status == 200
        role = ((body.get("metadata") or {}).get("annotations") or {}).get("iam.kubesphere.io/platform-role")
        assert role == "platform-admin", role

        ui.page.locator('[data-ai-id="users:search"]').last.fill(name)
        ui.page.wait_for_timeout(900)
        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        ui.page.locator('[data-ai-id="users:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="users:delete-confirm"]').click()
        ui.page.wait_for_timeout(3000)

        # A deleted user is not in the collection any more. (A direct GET answers 500
        # with "not found" on this endpoint, which is why the list is consulted.)
        status, listed = ui.api.request("GET", f"{USERS}?limit=-1&name={name}")
        assert status == 200
        assert [i["metadata"]["name"] for i in (listed.get("items") or [])] == [], listed
        screenshot(ui.page, "access-users-ops")
    finally:
        ui.api.request("DELETE", f"{USERS}/{name}")
