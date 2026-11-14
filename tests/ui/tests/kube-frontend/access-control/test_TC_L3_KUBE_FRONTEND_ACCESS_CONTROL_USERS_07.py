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


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_07(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07 用户列表：批量停用与启用。"""

    ui = access_control_page
    assert ui.api is not None
    prefix = f"tc-e2e-bulk-{uuid.uuid4().hex[:5]}"
    names = [f"{prefix}-a", f"{prefix}-b"]

    for name in names:
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

        for name in names:
            row = surface.locator(f'[data-ai-row="{name}"]')
            expect(row).to_be_visible(timeout=20_000)
            row.locator('input[type="checkbox"]').first.check()

        ui.page.locator('[data-ai-id="users:bulk-disable"]').click()
        deadline = time.time() + 40
        while time.time() < deadline and any(_state(ui.api, name) != "Disabled" for name in names):
            ui.page.wait_for_timeout(1_000)
        assert [_state(ui.api, name) for name in names] == ["Disabled", "Disabled"]

        ui.page.locator('[data-ai-id="users:bulk-enable"]').click()
        deadline = time.time() + 40
        while time.time() < deadline and any(_state(ui.api, name) != "Active" for name in names):
            ui.page.wait_for_timeout(1_000)
        assert [_state(ui.api, name) for name in names] == ["Active", "Active"]

        # admin cannot be disabled, so it must not be selectable — a checkbox that leads to a
        # refused action is a trap.
        admin_row = surface.locator('[data-ai-row="admin"]')
        expect(admin_row).to_be_visible(timeout=20_000)
        assert admin_row.locator('input[type="checkbox"]:not([disabled])').count() == 0

        screenshot(ui.page, "users-bulk")
    finally:
        for name in names:
            ui.api.request("DELETE", f"{USERS}/{name}")
