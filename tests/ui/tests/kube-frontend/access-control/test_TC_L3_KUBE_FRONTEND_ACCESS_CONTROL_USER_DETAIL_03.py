from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"
OLD_PASSWORD = "TcE2e@2026A"
NEW_PASSWORD = "TcE2e@2026B"


def _login(origin: str, username: str, password: str) -> int:
    request = urllib.request.Request(
        f"{origin.rstrip('/')}/api/session/login",
        data=json.dumps({"username": username, "password": password}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return int(response.status)
    except urllib.error.HTTPError as error:
        return int(error.code)


def _wait_login(origin: str, username: str, password: str, want: int, timeout_s: float = 30.0) -> int:
    """IAM identity is not always queryable the instant a User object returns 201."""
    deadline = time.time() + timeout_s
    last = 0
    while time.time() < deadline:
        last = _login(origin, username, password)
        if last == want:
            return last
        time.sleep(1.0)
    return last


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USER_DETAIL_03(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03 用户详情：管理员重置密码。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-rp-{uuid.uuid4().hex[:6]}"
    created, _ = ui.api.request(
        "POST",
        USERS,
        {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {
                "name": name,
                "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"},
            },
            "spec": {"email": f"{name}@example.com", "password": OLD_PASSWORD, "lang": "zh"},
        },
    )
    assert created in (200, 201), created
    assert _wait_login(ui.base_url, name, OLD_PASSWORD, 200) == 200, "temp user never became sign-in-able"

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/access/users/{name}")
        detail = ui.page.locator('[data-ai-id="user-detail:surface"]').last
        expect(detail).to_be_visible(timeout=30_000)
        expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        expect(ui.page.locator('[data-ai-id="user-detail:reset"]')).to_be_visible()
        screenshot(ui.page, "user-detail-reset-entry")

        ui.page.locator('[data-ai-id="user-detail:reset"]').click()
        expect(ui.page.locator("#user-reset\\:password")).to_be_visible(timeout=20_000)
        ui.page.locator("#user-reset\\:password").fill(NEW_PASSWORD)
        ui.page.locator("#user-reset\\:confirm").fill(NEW_PASSWORD)
        ui.page.locator('[data-ai-id="user-reset:submit"]').click()
        expect(ui.page.locator('[data-ai-id="user-reset:submit"]')).to_have_count(0, timeout=30_000)

        assert _wait_login(ui.base_url, name, NEW_PASSWORD, 200) == 200, "new password did not sign in after reset"
        assert _login(ui.base_url, name, OLD_PASSWORD) >= 400

        ui.page.goto(f"{ui.base_url}/kube-frontend/access/users/admin")
        admin = ui.page.locator('[data-ai-id="user-detail:surface"]').last
        expect(admin).to_be_visible(timeout=30_000)
        expect(admin).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        expect(ui.page.locator('[data-ai-id="user-detail:reset"]')).to_have_count(0)
        screenshot(ui.page, "user-detail-admin-no-reset")
    finally:
        ui.api.request("DELETE", f"{USERS}/{name}")
