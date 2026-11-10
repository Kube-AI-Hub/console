from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

TOGGLE = 'button[aria-label*="深浅色"]'


@pytest.mark.core
def test_TC_L2_KUBE_FRONTEND_THEME_02(page, ui_config, configmaps_page, screenshot):
    """TC-L2-KUBE-FRONTEND-THEME-02 手机宽度下按钮尺寸，以及弹层跟随主题。"""

    # Scoped viewport: `page` belongs to the session-wide context, so a size left
    # behind here changes the next case's layout assertions.
    original = page.viewport_size
    page.set_viewport_size({"width": 390, "height": 780})
    try:
        configmaps_page.url = f"{ui_config.base_url}/kube-frontend/system-workspace/clusters/host/projects/kube-frontend-demo/configmaps"
        configmaps_page.open()
        configmaps_page.wait_ready()

        toggle_box = page.locator(TOGGLE).bounding_box()
        locale_box = page.locator('[data-ai-id="shell:locale-switch"]').bounding_box()
        assert toggle_box and locale_box
        # Both are touch targets on a phone; the shared component's 36px default was
        # visibly smaller than the switch beside it.
        assert toggle_box["height"] >= 44, toggle_box
        assert round(toggle_box["height"]) == round(locale_box["height"]), (toggle_box, locale_box)

        overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert overflow is False

        # A portal is rendered under <body>, so it only inherits the theme because the
        # attribute lives on <html>.
        row = configmaps_page.surface.locator("tr[data-ai-row]").first
        row.locator('button[aria-label="更多操作"]').click()
        menu = page.locator("[role=menu]")
        menu.wait_for(state="visible")
        background = menu.evaluate("el => getComputedStyle(el).backgroundColor")
        expected = page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--ai-bg-overlay').trim()")
        assert expected, "the overlay token must be declared"
        assert background not in {"rgb(255, 255, 255)", "rgb(0, 0, 0)"}, background
        screenshot(page, "theme-mobile-menu")
    finally:
        page.set_viewport_size(original)
