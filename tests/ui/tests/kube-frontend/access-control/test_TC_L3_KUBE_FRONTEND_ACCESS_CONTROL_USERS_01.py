from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


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
    assert ui.row_names("users"), "list rendered no rows"
    screenshot(ui.page, "access-users")
