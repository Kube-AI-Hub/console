from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_MONITORING_01(monitoring_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-MONITORING-01 监控告警：两个页签切换不产生文档请求。"""

    ui = monitoring_page
    ui.open("alerts")
    ui.wait_ready("alerts")
    assert ui.active_tab() == "area-tabs:alerts"

    # Let the first navigation finish before counting, or a document request already
    # in flight is charged to the tab switch.
    ui.page.wait_for_load_state("networkidle")
    ui.page.wait_for_timeout(300)

    documents: list[str] = []
    ui.page.on("request", lambda request: documents.append(request.url) if request.resource_type == "document" else None)

    ui.page.locator('[data-ai-id="area-tabs:alertingrules"]').click()
    expect(ui.surface("alertingrules")).to_be_visible()
    ui.wait_ready("alertingrules")
    assert ui.active_tab() == "area-tabs:alertingrules"

    ui.page.locator('[data-ai-id="area-tabs:alerts"]').click()
    expect(ui.surface("alerts")).to_be_visible()
    ui.wait_ready("alerts")
    assert ui.active_tab() == "area-tabs:alerts"

    assert documents == [], f"tab switching reloaded the document: {documents}"
    assert "default" in ui.page.locator('[data-ai-id="workspace:current-project"]').inner_text()
    screenshot(ui.page, "monitoring-tabs")
