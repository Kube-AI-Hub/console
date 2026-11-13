from __future__ import annotations

from datetime import datetime

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USER_DETAIL_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01 用户详情：基本信息与登录历史。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{USERS}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取用户列表")
    names = [item["metadata"]["name"] for item in (body.get("items") or [])]
    if not names:
        pytest.skip("平台没有用户")
    name = "ui-test" if "ui-test" in names else names[0]

    status, user = ui.api.request("GET", f"{USERS}/{name}")
    if status != 200 or not isinstance(user, dict):
        pytest.skip("无法读取用户对象")
    state = str((user.get("status") or {}).get("state") or "Active")
    last_login = str((user.get("status") or {}).get("lastLoginTime") or "")

    status, records = ui.api.request("GET", f"{USERS}/{name}/loginrecords?limit=10")
    record_items = (records.get("items") or []) if status == 200 and isinstance(records, dict) else []

    ui.page.goto(f"{ui.base_url}/kube-frontend/access/users")
    surface = ui.page.locator('[data-ai-id="users:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    link = surface.locator(f'[data-ai-row="{name}"] a').first
    expect(link).to_have_attribute("href", f"/kube-frontend/access/users/{name}")
    link.click()

    detail = ui.page.locator('[data-ai-id="user-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert f"/access/users/{name}" in ui.page.url, ui.page.url

    basic = ui.page.locator('[data-ai-id="user-detail:basic"]').inner_text()
    assert state in basic, f"状态应为 {state}: {basic[:200]}"
    # The authoritative last sign-in is status.lastLoginTime, rendered in local time — so
    # compare against the local rendering of that instant, not its UTC date.
    if last_login:
        expected = datetime.fromisoformat(last_login.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d %H:%M:%S")
        assert expected in basic, f"最近登录应为 {expected}: {basic[:240]}"

    logins = ui.page.locator('[data-ai-id="user-detail:login-list"] [data-ai-row]')
    if record_items:
        # The history is a second query: poll instead of reading the count the instant the
        # page reports ready, otherwise a slow first render reads as "no records".
        expect(logins).to_have_count(len(record_items), timeout=30_000)
    else:
        assert logins.count() == 0
        expect(ui.page.locator('[data-ai-id="user-detail:logins"]')).to_contain_text("没有记录到登录", timeout=20_000)

    screenshot(ui.page, "user-detail")
