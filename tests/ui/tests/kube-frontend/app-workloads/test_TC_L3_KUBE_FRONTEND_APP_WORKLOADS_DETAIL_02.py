from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02 负载详情：返回列表保留页签。"""

    ui = app_workloads_page
    name = ui.unique("back")
    try:
        ui.create_deployment(name, replicas=1)
        ui.open_detail("deployments", name)
        expect(ui.detail_surface("deployments")).to_be_visible()

        ui.back_link.click()
        ui.page.wait_for_url(f"**/projects/{ui.namespace}/deployments")
        expect(ui.surface("deployments")).to_be_visible()

        assert ui.active_tab_key() == "deployments", ui.active_tab_key()
        assert ui.active_tab_label() == "部署"
        expect(ui.current_project).to_contain_text(ui.namespace)
        screenshot(ui.page, "back-to-list")
    finally:
        ui.delete_deployment(name)
