from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MEMBERS = "/kapis/iam.kubesphere.io/v1alpha2/namespaces/default/members"
USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"
USER = "ui-test"


def _ensure_user(api) -> None:
    """Make the invited account exist.

    The invitation writes a role binding for a subject; on a deployment without that user the
    binding is created for a phantom and the member list never shows the role. Creating it here
    keeps the case runnable anywhere, and the case removes it again.
    """
    status, body = api.request("GET", f"{USERS}/{USER}")
    if status == 200:
        return
    api.request(
        "POST",
        USERS,
        {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {"name": USER},
            "spec": {"email": "ui-test@example.com", "password": "UiTest@2026"},
        },
    )


def _members(api) -> list[dict]:
    status, body = api.request("GET", MEMBERS)
    if status != 200 or not isinstance(body, dict):
        return []
    return body.get("items") or []


def _role(api) -> str | None:
    for item in _members(api):
        if item["metadata"]["name"] == USER:
            return ((item["metadata"].get("annotations") or {}).get("iam.kubesphere.io/role"))
    return None


def _cleanup(api) -> None:
    api.request("DELETE", f"{MEMBERS}/{USER}")
    api.request("DELETE", f"{USERS}/{USER}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_MEMBERS_02(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02 项目成员：邀请、修改角色与移除。"""

    ui = project_settings_page
    assert ui.api is not None
    _cleanup(ui.api)
    _ensure_user(ui.api)

    try:
        ui.page.goto(
            f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/members"
        )
        surface = ui.page.locator('[data-ai-id="members:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        # ---- invite ----
        ui.page.locator('[data-ai-id="members:invite"]').click()
        dialog = ui.page.locator('[data-ai-id="settings:member-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="settings:member-username"]').fill(USER)
        ui.page.locator('[data-ai-id="settings:member-role"] button').click()
        ui.page.get_by_role("option", name="viewer", exact=True).click()
        ui.page.locator('[data-ai-id="settings:member-submit"]').click()

        deadline = time.time() + 60
        while time.time() < deadline and _role(ui.api) is None:
            ui.page.wait_for_timeout(1_000)
        assert _role(ui.api) == "viewer", f"邀请后角色应为 viewer，实际 {_role(ui.api)!r}"
        expect(surface.locator(f'[data-ai-row="{USER}"]')).to_be_visible(timeout=30_000)

        # ---- change role ----
        row = surface.locator(f'[data-ai-row="{USER}"]')
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="修改角色", exact=True).click()
        expect(dialog).to_be_visible(timeout=20_000)
        # The username identifies the member and cannot be edited here.
        expect(ui.page.locator('[data-ai-id="settings:member-username"]')).to_be_disabled()
        ui.page.locator('[data-ai-id="settings:member-role"] button').click()
        ui.page.get_by_role("option", name="operator", exact=True).click()
        ui.page.locator('[data-ai-id="settings:member-submit"]').click()

        deadline = time.time() + 60
        while time.time() < deadline and _role(ui.api) != "operator":
            ui.page.wait_for_timeout(1_000)
        assert _role(ui.api) == "operator", f"修改后角色应为 operator，实际 {_role(ui.api)!r}"

        screenshot(ui.page, "project-members")

        # ---- remove ----
        row = surface.locator(f'[data-ai-row="{USER}"]')
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="移除成员", exact=True).click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="members:delete-input"]').fill(USER)
        ui.page.locator('[data-ai-id="members:delete-confirm"]').click()

        deadline = time.time() + 60
        while time.time() < deadline and _role(ui.api) is not None:
            ui.page.wait_for_timeout(1_000)
        assert _role(ui.api) is None, "移除后成员仍在项目中"
        expect(surface.locator(f'[data-ai-row="{USER}"]')).to_have_count(0, timeout=30_000)
    finally:
        _cleanup(ui.api)
