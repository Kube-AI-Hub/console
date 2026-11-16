from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
import uuid

import pytest

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"
LOGINRECORDS = "/kapis/iam.kubesphere.io/v1alpha2/loginrecords"
PASSWORD = "TcE2e@2026C"


def _login(origin: str, username: str, password: str) -> int:
    request = urllib.request.Request(
        f"{origin.rstrip('/')}/kube-frontend/api/session/login",
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


def _record_count(api, username: str) -> int:
    ok, body = api.request("GET", f"{USERS}/{username}/loginrecords?page=1&limit=1&sortBy=createTime")
    assert ok == 200, ok
    return int(body.get("totalItems", 0))


def _create_user(api, name: str) -> None:
    created, _ = api.request(
        "POST",
        USERS,
        {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {
                "name": name,
                "annotations": {"iam.kubesphere.io/platform-role": "platform-regular"},
            },
            "spec": {"email": f"{name}@example.com", "password": PASSWORD, "lang": "zh"},
        },
    )
    assert created in (200, 201), created


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USER_DETAIL_04(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04 登录记录在登录写入时按用户裁剪。"""

    ui = access_control_page
    assert ui.api is not None

    subject = f"tc-e2e-lr-{uuid.uuid4().hex[:6]}"
    control = f"tc-e2e-lrc-{uuid.uuid4().hex[:6]}"
    _create_user(ui.api, subject)
    _create_user(ui.api, control)

    try:
        assert _wait_login(ui.base_url, subject, PASSWORD, 200) == 200
        assert _wait_login(ui.base_url, control, PASSWORD, 200) == 200

        control_before = _record_count(ui.api, control)
        assert control_before > 0, "control user produced no login record"

        # Force the subject past the configured cap by writing extra records.
        # The cap is 200 by default; 210 leaves headroom without a huge burst.
        extra = 210
        for index in range(extra):
            created, _ = ui.api.request(
                "POST",
                LOGINRECORDS,
                {
                    "apiVersion": "iam.kubesphere.io/v1alpha2",
                    "kind": "LoginRecord",
                    "metadata": {
                        "generateName": f"{subject}-tc-",
                        "labels": {"iam.kubesphere.io/user-ref": subject},
                    },
                    "spec": {
                        "type": "Password",
                        "success": True,
                        "reason": "tc fixture",
                        "sourceIP": "127.0.0.1",
                        "userAgent": "tc",
                    },
                },
            )
            assert created in (200, 201), (index, created)

        assert _record_count(ui.api, subject) > 200, "fixture did not exceed the cap"

        # A single successful login must trim the subject back under the cap.
        assert _wait_login(ui.base_url, subject, PASSWORD, 200) == 200
        time.sleep(2.0)

        trimmed = _record_count(ui.api, subject)
        assert trimmed <= 200, f"login did not trim login records: {trimmed}"

        ok, user = ui.api.request("GET", f"{USERS}/{subject}")
        assert ok == 200, ok
        last_login = ((user.get("status") or {}).get("lastLoginTime")) or ""
        assert last_login, "lastLoginTime was not maintained on login"

        assert _record_count(ui.api, control) == control_before, "trimming touched another user's records"

        ui.page.goto(f"{ui.base_url}/kube-frontend/access/users/{subject}")
        surface = ui.page.locator('[data-ai-id="user-detail:surface"]').last
        surface.wait_for(timeout=30_000)
        screenshot(ui.page, "user-detail-trimmed-history")
    finally:
        ui.api.request("DELETE", f"{USERS}/{subject}")
        ui.api.request("DELETE", f"{USERS}/{control}")
