from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACES_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01 访问控制：workspaces 的列集合。"""

    ui = access_control_page
    if not ui.has_data("workspaces"):
        pytest.skip(f"平台没有 workspaces 数据，无法核对列")

    ui.open("workspaces")
    ui.wait_ready("workspaces")

    headers = ui.headers("workspaces")
    required = ["名称", "状态", "集群", "创建时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"
    assert ui.row_names("workspaces"), "list rendered no rows"
    screenshot(ui.page, "access-workspaces")
