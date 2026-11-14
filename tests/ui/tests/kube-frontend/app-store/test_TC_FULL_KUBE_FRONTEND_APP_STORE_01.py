from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_APP_STORE_01(page, ui_config, screenshot):
    """TC-FULL-KUBE-FRONTEND-APP_STORE-01 两个顶栏入口可达且页签可切换。"""

    app = ui_config.app

    page.goto(f"{app}/kube-frontend/apps")
    expect(page.locator('[data-ai-id="app-store:surface"]')).to_be_visible(timeout=30_000)

    page.goto(f"{app}/kube-frontend/apps-manage")
    expect(page).to_have_url(re.compile(r"/kube-frontend/apps-manage/store$"), timeout=30_000)

    documents: list[str] = []
    page.on("request", lambda r: documents.append(r.url) if r.resource_type == "document" else None)
    for key in ("categories", "reviews", "store"):
        page.locator(f'[data-ai-id="area-tabs:{key}"]').click()
        expect(page.locator(f'[data-ai-id="store-manage:{key}:surface"]')).to_be_visible(timeout=30_000)
    assert documents == [], f"切换页签重新加载了文档: {documents}"
    screenshot(page, "app-store-entry")
