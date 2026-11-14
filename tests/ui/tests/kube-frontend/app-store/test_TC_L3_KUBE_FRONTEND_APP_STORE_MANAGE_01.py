from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_MANAGE_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-01 商店管理：三个页签与默认重定向。"""

    app = ui_config.app
    # `/apps-manage` 默认落在「应用」，与老 console 的 /store 一致。
    page.goto(f"{app}/kube-frontend/apps-manage")
    expect(page).to_have_url(re.compile(r"/kube-frontend/apps-manage/store$"), timeout=30_000)

    for view in ("store", "categories", "reviews"):
        page.goto(f"{app}/kube-frontend/apps-manage/{view}")
        surface = page.locator(f'[data-ai-id="store-manage:{view}:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        # Every tab must show something: a table or its own empty state, never a blank area.
        page.wait_for_function(
            """(view) => {
                const el = document.querySelector('[data-ai-id="store-manage:' + view + ':surface"]');
                return el && el.innerText.trim().length > 10;
            }""",
            arg=view,
            timeout=60_000,
        )

    # The three tabs must be one area, so switching does not reload the document.
    tabs = page.locator('[data-ai-id^="area-tabs:"]').first
    expect(tabs).to_be_visible()
    for key in ("store", "categories", "reviews"):
        expect(page.locator(f'[data-ai-id="area-tabs:{key}"]')).to_be_visible()
    screenshot(page, "app-store-manage")
