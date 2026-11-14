from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CONSOLE_CORE_RESOURCE_DETAIL_NOT_FOUND_PAGE_01(page, ui_config, screenshot):
    """TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND_PAGE-01 404 兜底页。"""

    page.goto(f"{ui_config.app}/kube-frontend/this-page-does-not-exist")
    surface = page.locator('[data-ai-id="not-found:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(page.locator('[data-ai-id="not-found:title"]')).to_have_text("页面不存在", timeout=20_000)

    link = surface.locator("a").first
    assert link.get_attribute("href") in ("/kube-frontend", "/kube-frontend/"), link.get_attribute("href")

    screenshot(page, "not-found")
