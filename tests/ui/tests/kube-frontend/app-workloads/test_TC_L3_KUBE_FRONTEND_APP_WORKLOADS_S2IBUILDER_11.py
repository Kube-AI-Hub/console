from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_11(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-11 事件：无 Job 时如实提示，不渲染事件表。"""

    ui = image_builder_page
    name = ui.unique("events")
    try:
        assert ui.create_builder(name) == 201
        assert ui.create_run(name, f"{name}-run-1") == 201

        ui.open_detail(name)
        ui.open_tab("events")
        expect(ui.page.locator('[data-ai-id="image-builder-detail:no-job"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="image-builder-detail:events-table"]')).to_have_count(0)
        screenshot(ui.page, "image-builder-events")
    finally:
        ui.delete_builder(name)
