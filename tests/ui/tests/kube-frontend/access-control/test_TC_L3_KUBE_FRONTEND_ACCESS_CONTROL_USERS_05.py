from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


def _state(api, name: str) -> str | None:
    status, body = api.request("GET", f"{USERS}/{name}")
    if status != 200 or not isinstance(body, dict):
        return None
    return ((body.get("status") or {}).get("state")) or "Active"


def _cleanup(api, name: str) -> None:
    api.request("DELETE", f"{USERS}/{name}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_05(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05 用户列表：停用、启用与删除。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-u-{uuid.uuid4().hex[:6]}"

    created, _ = ui.api.request(
        "POST",
        USERS,
        {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {"name": name},
            "spec": {"email": f"{name}@example.com", "password": "TcE2e@2026", "lang": "zh"},
        },
    )
    assert created in (200, 201), created

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/access/users")
        surface = ui.page.locator('[data-ai-id="users:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="users:search"]').fill(name)
        # The search is server-side and debounced: wait for the refetch to settle before
        # clicking, otherwise the row is detached mid-click when the answer arrives.
        ui.page.wait_for_timeout(2_500)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=30_000)
        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=20_000)

        # ---- disable ----
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="停用", exact=True).click()
        deadline = time.time() + 30
        while time.time() < deadline and _state(ui.api, name) != "Disabled":
            ui.page.wait_for_timeout(1_000)
        assert _state(ui.api, name) == "Disabled", "停用后 status.state 不是 Disabled"

        # ---- the menu follows the state: one entry, mutually exclusive ----
        expect(surface.locator(f'[data-ai-row="{name}"]')).to_be_visible(timeout=20_000)
        row = surface.locator(f'[data-ai-row="{name}"]')
        row.locator('button[aria-haspopup="menu"]').click()
        labels = [item.strip() for item in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "启用" in labels and "停用" not in labels, labels
        ui.page.get_by_role("menuitem", name="启用", exact=True).click()

        deadline = time.time() + 30
        while time.time() < deadline and _state(ui.api, name) != "Active":
            ui.page.wait_for_timeout(1_000)
        assert _state(ui.api, name) == "Active", "启用后 status.state 不是 Active"

        screenshot(ui.page, "users-lifecycle")

        # ---- delete ----
        row = surface.locator(f'[data-ai-row="{name}"]')
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="users:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="users:delete-confirm"]').click()
        expect(surface.locator(f'[data-ai-row="{name}"]')).to_have_count(0, timeout=30_000)

        # ---- the admin account cannot lock the platform out ----
        ui.page.locator('[data-ai-id="users:search"]').fill("admin")
        admin_row = surface.locator('[data-ai-row="admin"]')
        expect(admin_row).to_be_visible(timeout=20_000)
        menu = admin_row.locator('button[aria-haspopup="menu"]')
        if menu.count():
            menu.click()
            admin_labels = [item.strip() for item in ui.page.get_by_role("menuitem").all_inner_texts()]
            assert "停用" not in admin_labels and "删除" not in admin_labels, admin_labels
            ui.page.keyboard.press("Escape")
    finally:
        _cleanup(ui.api, name)
