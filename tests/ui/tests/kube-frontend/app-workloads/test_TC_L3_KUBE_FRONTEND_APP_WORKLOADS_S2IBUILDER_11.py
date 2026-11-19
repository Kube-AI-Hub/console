from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_11(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-11 事件：无 Job 时如实提示，不渲染事件表。"""

    ui = image_builder_page
    if not ui.available():
        pytest.skip("本集群未安装 S2I 构建器 CRD（devops/s2ioperator），构建记录用例无法造数")
    name = ui.unique("events")
    try:
        assert ui.create_builder(name) == 201
        assert ui.create_run(name, f"{name}-run-1") == 201
        reported = ui.controller_reports(f"{name}-run-1")
        if reported:
            pytest.skip(f"本环境有真实 s2ioperator（runState={reported!r}），无法构造「控制器尚未创建 Job」的状态")

        ui.open_detail(name)
        ui.open_tab("events")
        expect(ui.page.locator('[data-ai-id="image-builder-detail:no-job"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="image-builder-detail:events-table"]')).to_have_count(0)
        screenshot(ui.page, "image-builder-events")
    finally:
        ui.delete_builder(name)