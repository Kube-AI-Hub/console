from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_BROWSE_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-BROWSE-01 商店浏览：分类栏、空态、商店管理入口。"""

    page.goto(f"{ui_config.app}/kube-frontend/apps")
    surface = page.locator('[data-ai-id="app-store:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-ai-id="app-store:surface"]');
            return el && el.getAttribute('data-ai-state') !== 'loading';
        }""",
        timeout=60_000,
    )

    state = surface.get_attribute("data-ai-state")
    assert state in ("ready", "empty"), f"应用商店进入了 {state} 状态"

    # The category rail is always there, even with an empty store: it is the only hint that
    # browsing is possible and the store is merely unpopulated.
    expect(page.locator('[data-ai-id="app-store:categories"]')).to_be_visible()
    expect(page.locator('[data-ai-id="app-store:category:all"]')).to_be_visible()

    if state == "empty":
        body = page.locator('[data-ai-id="app-store:empty"]').inner_text()
        # "No apps" without a cause reads as a bug; say where apps come from.
        assert "应用仓库" in body or "还没有应用" in body, body[:200]

    # 商店管理入口必须真的跳转——它曾经是死链。
    page.locator('[data-ai-id="app-store:manage"]').click()
    expect(page).to_have_url(__import__("re").compile(r"/kube-frontend/apps-manage(/store)?$"), timeout=30_000)
    screenshot(page, "app-store-browse")
