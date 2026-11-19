from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_08(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-08 资源状态：控制器未创建 Job 时如实提示，不伪造空表。"""

    ui = image_builder_page
    if not ui.available():
        pytest.skip("本集群未安装 S2I 构建器 CRD（devops/s2ioperator），构建记录用例无法造数")
    name = ui.unique("status")
    try:
        assert ui.create_builder(name) == 201
        assert ui.create_run(name, f"{name}-run-1") == 201
        reported = ui.controller_reports(f"{name}-run-1")
        if reported:
            pytest.skip(f"本环境有真实 s2ioperator（runState={reported!r}），无法构造「控制器尚未创建 Job」的状态")

        ui.open_detail(name)
        ui.open_tab("resource-status")
        notice = ui.page.locator('[data-ai-id="image-builder-detail:no-job"]')
        expect(notice).to_be_visible()
        # The reason names the controller, not "no data".
        text = notice.inner_text()
        assert "Job" in text or "构建任务" in text, text
        expect(ui.page.locator('[data-ai-id="image-builder-detail:ports-table"]')).to_have_count(0)
        expect(ui.page.locator('[data-ai-id="image-builder-detail:pods-table"]')).to_have_count(0)
        screenshot(ui.page, "image-builder-resource-status")
    finally:
        ui.delete_builder(name)