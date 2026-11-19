from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_STATUS_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02 状态派生：Pending 容器组显示等待中。"""

    ui = app_workloads_page
    name = ui.unique("pending")
    try:
        # An unsatisfiable nodeSelector keeps the pod out of every scheduler queue,
        # so its phase stays Pending without needing a broken image pull.
        ui.create_pending_pod(name)
        ui.wait_pod_phase(name, "Pending")

        ui.open("pods")
        ui.ensure_row("pods", name)
        ui.wait_row_status("pods", name, ("等待中", "运行中", "已完成", "错误"))

        row = ui.row_text("pods", name)
        assert "等待中" in row, row
        screenshot(ui.page, "status-waiting")
    finally:
        ui.delete_pod(name)
