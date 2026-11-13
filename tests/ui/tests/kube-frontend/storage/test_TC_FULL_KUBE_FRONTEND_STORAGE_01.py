from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_STORAGE_01(storage_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-STORAGE-01 存储：两个页签之间切换不产生文档请求。"""

    ui = storage_page
    ui.open("persistentvolumeclaims")
    ui.wait_ready("persistentvolumeclaims")
    expect(ui.surface("persistentvolumeclaims")).to_be_visible()

    # Count document loads from here on: a tab switch that reloads the page shows up
    # as one, and that is precisely the regression this criterion guards.
    documents: list[str] = []
    ui.page.on("request", lambda request: documents.append(request.url) if request.resource_type == "document" else None)

    ui.page.locator('[data-ai-id="area-tabs:volumesnapshots"]').click()
    expect(ui.surface("volumesnapshots")).to_be_visible()
    ui.wait_ready("volumesnapshots")

    ui.page.locator('[data-ai-id="area-tabs:persistentvolumeclaims"]').click()
    expect(ui.surface("persistentvolumeclaims")).to_be_visible()
    ui.wait_ready("persistentvolumeclaims")

    assert documents == [], f"tab switching reloaded the document: {documents}"
    expect(ui.page.locator('[data-ai-id="area-tabs:persistentvolumeclaims"]')).to_have_attribute("aria-current", "page")
    # The project in the workspace bar survives both switches.
    assert "default" in ui.page.locator('[data-ai-id="workspace:current-project"]').inner_text()
    screenshot(ui.page, "storage-tabs")
