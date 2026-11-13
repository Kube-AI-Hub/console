from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_STATUS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01 状态派生：部分就绪的部署显示更新中。"""

    ui = app_workloads_page
    name = ui.unique("status")
    try:
        # Three replicas that can never become ready: the un-pullable image keeps
        # `status.readyReplicas` at 0, so the row must read 更新中, not 运行中.
        ui.create_deployment(name, replicas=3)

        status, body = ui.get_deployment(name)
        assert status == 200, (status, body)
        ready = int((body.get("status") or {}).get("readyReplicas") or 0)
        assert ready == 0, f"deployment unexpectedly became ready: {body.get('status')}"

        ui.open("deployments")
        ui.ensure_row("deployments", name)

        row = ui.row_text("deployments", name)
        assert "更新中" in row, row
        assert "运行中" not in row, row
        assert "0/3" in row, row
        screenshot(ui.page, "status-updating")
    finally:
        ui.delete_deployment(name)
