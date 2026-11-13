from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01 工作负载列表：表格列与可点击名称。"""

    ui = app_workloads_page
    name = ui.unique("list")
    try:
        ui.create_deployment(name, replicas=1)
        ui.open("deployments")
        assert ui.state("deployments") == "ready", ui.state("deployments")

        headers = ui.headers("deployments")
        assert headers[:4] == ["名称", "状态", "就绪", "创建时间"], headers

        ui.ensure_row("deployments", name)
        link = ui.name_link("deployments", name)
        expect(link).to_be_visible()
        assert link.get_attribute("href").endswith(f"/deployments/{name}")

        row = ui.row_text("deployments", name)
        assert "更新中" in row, row
        assert "0/1" in row, row

        # The name is not decoration: clicking it is how the detail is reached.
        ui.click_name("deployments", name)
        ui.page.wait_for_url(f"**/deployments/{name}")
        expect(ui.detail_surface("deployments")).to_be_visible()
        screenshot(ui.page, "list")
    finally:
        ui.delete_deployment(name)
