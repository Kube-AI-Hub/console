from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


def _get(api, name: str) -> dict:
    status, body = api.request("GET", f"{USERS}/{name}")
    assert status == 200 and isinstance(body, dict), status
    return body


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_06(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06 用户列表：编辑邮箱与描述。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-ue-{uuid.uuid4().hex[:6]}"
    email_a = f"{name}@a.example.com"
    email_b = f"{name}@b.example.com"
    description = "E2E 描述"

    created, _ = ui.api.request(
        "POST",
        USERS,
        {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {"name": name},
            "spec": {"email": email_a, "password": "TcE2e@2026", "lang": "zh"},
        },
    )
    assert created in (200, 201), created

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/access/users")
        surface = ui.page.locator('[data-ai-id="users:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="users:search"]').fill(name)
        ui.page.wait_for_timeout(2_500)
        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=20_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="编辑信息", exact=True).click()

        email_field = ui.page.locator(r"#users\:edit-email")
        expect(email_field).to_be_visible(timeout=20_000)
        # The dialog reads the user first; an empty field here means it filled from the list row.
        expect(email_field).to_have_value(email_a, timeout=20_000)

        email_field.fill(email_b)
        ui.page.locator(r"#users\:edit-description").fill(description)
        ui.page.locator('[data-ai-id="users:edit-submit"]').click()

        deadline = time.time() + 30
        while time.time() < deadline and (_get(ui.api, name).get("spec") or {}).get("email") != email_b:
            ui.page.wait_for_timeout(1_000)
        body = _get(ui.api, name)
        assert (body.get("spec") or {}).get("email") == email_b, body.get("spec")
        annotations = (body.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/description") == description, annotations

        screenshot(ui.page, "users-edit")
    finally:
        ui.api.request("DELETE", f"{USERS}/{name}")
