from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

IMAGE = "tc-e2e.invalid/detail:1.0"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01 负载详情：六项属性与容器镜像。"""

    ui = app_workloads_page
    name = ui.unique("detail")
    try:
        ui.create_deployment(name, replicas=1, image=IMAGE)

        # Enter through the list's name link, which is the path the criterion names.
        ui.open("deployments")
        ui.click_name("deployments", name)
        ui.page.wait_for_url(f"**/deployments/{name}")
        expect(ui.detail_surface("deployments")).to_be_visible()
        ui.wait_ready(ui.detail_surface("deployments"))

        labels = ui.attribute_labels("deployments")
        assert labels == ["集群", "项目", "应用", "副本", "创建时间", "创建者"], labels
        assert ui.attribute_value("deployments", "集群") == "host"
        assert ui.attribute_value("deployments", "项目") == "default"
        assert ui.attribute_value("deployments", "副本") == "0/1"

        images = ui.container_images("deployments")
        assert IMAGE in images, images
        screenshot(ui.page, "detail")
    finally:
        ui.delete_deployment(name)
