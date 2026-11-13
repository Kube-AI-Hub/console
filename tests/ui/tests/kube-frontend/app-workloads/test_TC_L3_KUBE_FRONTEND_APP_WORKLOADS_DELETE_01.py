from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DELETE_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01 删除负载：输入名称确认后行消失。"""

    ui = app_workloads_page
    name = ui.unique("delete")
    try:
        ui.create_deployment(name, replicas=1)
        ui.open("deployments")
        ui.ensure_row("deployments", name)

        ui.open_row_menu("deployments", name)
        ui.click_row_action("删除")
        expect(ui.dialog).to_be_visible()

        confirm = ui.page.locator('[data-ai-id="deployments:delete-confirm"]')
        expect(confirm).to_be_disabled()
        ui.fill("deployments:delete-input", name[:-1])
        expect(confirm).to_be_disabled()
        ui.fill("deployments:delete-input", name)
        expect(confirm).to_be_enabled()
        confirm.click()

        expect(ui.dialog).to_have_count(0)
        expect(ui.row("deployments", name)).to_have_count(0, timeout=15_000)
        status, body = ui.get_deployment(name)
        assert status == 404, (status, body)
        screenshot(ui.page, "list-after-delete")
    finally:
        # Defensive: a 404 here is the expected outcome when the UI deleted it.
        ui.delete_deployment(name)
