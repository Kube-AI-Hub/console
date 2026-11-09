from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_MOBILE_01(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-01 窄屏无横向滚动，导航收进抽屉。"""

    configmaps_page.page.set_viewport_size({"width": 375, "height": 812})
    configmaps_page.open()
    configmaps_page.wait_ready()

    scroll_width = configmaps_page.page.evaluate("() => document.documentElement.scrollWidth")
    assert scroll_width <= 375, f"出现横向滚动：{scroll_width}"

    toggle = configmaps_page.page.locator('[data-ai-id="shell:nav-toggle"]')
    expect(toggle).to_be_visible()
    box = toggle.bounding_box()
    assert box and box["width"] >= 44 and box["height"] >= 44, box

    toggle.click()
    expect(configmaps_page.page.get_by_role("dialog")).to_be_visible()
    screenshot(configmaps_page.page, "mobile-drawer")
