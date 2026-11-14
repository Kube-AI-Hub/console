from __future__ import annotations

from datetime import datetime

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01 访问控制：users 的列集合。"""

    ui = access_control_page
    if not ui.has_data("users"):
        pytest.skip(f"平台没有 users 数据，无法核对列")

    ui.open("users")
    ui.wait_ready("users")

    headers = ui.headers("users")
    required = ["用户名", "状态", "平台角色", "最近登录"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"
    names = ui.row_names("users")
    assert names, "list rendered no rows"

    listed = ui.api.request("GET", f"{USERS}?limit=10&sortBy=createTime&ascending=false") if ui.api is not None else (0, None)
    if listed[0] == 200 and isinstance(listed[1], dict):
        api_names = [str((item.get("metadata") or {}).get("name") or "") for item in listed[1].get("items") or []]
        api_names = [n for n in api_names if n]
        assert names == api_names, f"default order should follow createTime desc: ui={names} api={api_names}"

    target = "admin" if "admin" in names else names[0]
    status, user = ui.api.request("GET", f"{USERS}/{target}") if ui.api is not None else (0, None)
    if status == 200 and isinstance(user, dict):
        last = str((user.get("status") or {}).get("lastLoginTime") or "")
        row = ui.page.locator(f'[data-ai-id="users:surface"] [data-ai-row="{target}"]').last
        text = row.inner_text()
        if last:
            expected = datetime.fromisoformat(last.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d %H:%M:%S")
            assert expected in text, f"最近登录应为 {expected}: {text[:240]}"
        else:
            assert "尚未登录" in text, text[:240]
    screenshot(ui.page, "access-users")
