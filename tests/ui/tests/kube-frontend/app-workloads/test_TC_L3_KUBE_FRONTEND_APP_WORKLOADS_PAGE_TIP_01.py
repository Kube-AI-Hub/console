from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

TIP = '[data-ai-id="page-tip"]'
CLOSE = '[data-ai-id="page-tip:close"]'
LINK = '[data-ai-id="page-tip:link"]'
KEY_PREFIX = "kube-frontend.page-tip.dismissed."

#: Each page's tip must contain the fact the page exists to warn about.
PAGE_HINTS = {
    "configmaps": "明文",
    "secrets": "base64",
    "serviceaccounts": "令牌",
    "pods": "重建",
}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_PAGE_TIP_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PAGE_TIP-01 列表页头提示：展示、关闭与按页持久化。"""

    ui = app_workloads_page
    keys = [KEY_PREFIX + page for page in ("deployments", *PAGE_HINTS)]
    try:
        # Start from a clean slate: an earlier run in this browser context may have
        # dismissed the tip, and "hidden because remembered" is not what this asserts.
        ui.page.goto(ui.url("deployments"))
        ui.page.evaluate("keys => keys.forEach((key) => localStorage.removeItem(key))", keys)
        ui.page.reload()

        tip = ui.page.locator(TIP)
        expect(tip).to_be_visible(timeout=30_000)
        text = tip.inner_text()
        assert "部署" in text, text
        assert "滚动更新" in text, text

        link = ui.page.locator(LINK)
        expect(link).to_be_visible()
        href = link.get_attribute("href") or ""
        assert "kubernetes.io" in href, href

        # Closing hides the bar and records the dismissal for this page only.
        ui.page.locator(CLOSE).click()
        expect(tip).to_have_count(0, timeout=10_000)
        stored = ui.page.evaluate("key => localStorage.getItem(key)", KEY_PREFIX + "deployments")
        assert stored == "1", stored

        ui.page.reload()
        expect(ui.page.locator('[data-ai-id="deployments:surface"]')).to_be_visible(timeout=30_000)
        ui.page.wait_for_timeout(1000)
        expect(ui.page.locator(TIP)).to_have_count(0)

        # A dismissal is per page: the other lists still show their own tip.
        for page, hint in PAGE_HINTS.items():
            ui.page.goto(ui.url(page))
            ui.page.evaluate("key => localStorage.removeItem(key)", KEY_PREFIX + page)
            ui.page.reload()
            page_tip = ui.page.locator(TIP)
            expect(page_tip).to_be_visible(timeout=30_000)
            page_text = page_tip.inner_text()
            assert hint in page_text, (page, hint, page_text)

        ui.page.goto(ui.url("deployments"))
        ui.page.wait_for_timeout(800)
        expect(ui.page.locator(TIP)).to_have_count(0)
        screenshot(ui.page, "page-tip")
    finally:
        # localStorage is shared by the session-scoped browser context; leave it as found.
        ui.page.evaluate("keys => keys.forEach((key) => localStorage.removeItem(key))", keys)
