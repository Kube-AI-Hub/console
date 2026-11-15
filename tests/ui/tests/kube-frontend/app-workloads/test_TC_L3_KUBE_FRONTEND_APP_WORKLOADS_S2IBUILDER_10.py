from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_10(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-10 环境变量：无 Job 时如实提示，不渲染容器表。"""

    ui = image_builder_page
    name = ui.unique("env")
    try:
        assert ui.create_builder(name, environment={"MAVEN_ARGS": "-DskipTests"}) == 201
        assert ui.create_run(name, f"{name}-run-1") == 201

        ui.open_detail(name)
        ui.open_tab("environment")
        notice = ui.page.locator('[data-ai-id="image-builder-detail:no-job"]')
        expect(notice).to_be_visible()
        # The environment tab reads the Job's containers; without a Job there is no table,
        # and the builder's configured variables must not be misrepresented as runtime env.
        assert ui.page.locator('[data-ai-id^="image-builder-detail:env-container:"]').count() == 0
        screenshot(ui.page, "image-builder-environment")
    finally:
        ui.delete_builder(name)
