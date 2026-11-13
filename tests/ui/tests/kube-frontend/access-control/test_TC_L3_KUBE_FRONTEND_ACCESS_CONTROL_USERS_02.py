from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02 用户：创建与密码校验。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-u{int(__import__('time').time() * 1000) % 1_000_000}"
    try:
        ui.open("users")
        ui.wait_ready("users")
        ui.page.locator('[data-ai-id="users:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()

        # An illegal user name is refused before a request is made.
        ui.page.locator("#ai-field-name").fill("Bad Name")
        ui.page.locator("#ai-field-email").fill("u@example.com")
        ui.page.locator("#ai-field-password").fill("Strong12345")
        dialog.get_by_role("button", name="确认").click()
        ui.page.wait_for_timeout(500)
        expect(dialog).to_be_visible()

        # So is a password the platform would reject, with the reason spelled out.
        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-password").fill("short")
        dialog.get_by_role("button", name="确认").click()
        ui.page.wait_for_timeout(500)
        expect(dialog).to_be_visible()
        assert "8 位" in dialog.inner_text()

        ui.page.locator("#ai-field-password").fill("Strong12345")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, body = ui.api.request("GET", f"{USERS}/{name}")
        assert status == 200, (status, body)
        # The role is an annotation: a user without it can sign in but do nothing.
        role = ((body.get("metadata") or {}).get("annotations") or {}).get("iam.kubesphere.io/platform-role")
        assert role == "platform-regular", role
        screenshot(ui.page, "access-users-create")
    finally:
        ui.api.request("DELETE", f"{USERS}/{name}")
