from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PLATFORM_SETTINGS_APPEARANCE_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-01 外观：深浅色与色调切换并保持。"""

    page.goto(f"{ui_config.app}/kube-frontend/settings/info")
    section = page.locator('[data-ai-id="platform-info:appearance"]')
    expect(section).to_be_visible(timeout=30_000)

    html = page.locator("html")
    original_accent = html.get_attribute("data-accent") or "violet"
    original_mode = html.get_attribute("data-theme") or "dark"

    try:
        # A tone change must reach the document root, not just the button: the whole
        # palette is keyed off `data-accent`, so anything else would look like a no-op.
        page.locator('[data-ai-id="appearance:accent:green"]').click()
        expect(html).to_have_attribute("data-accent", "green", timeout=10_000)
        expect(page.locator('[data-ai-id="appearance:accent:green"]')).to_have_attribute("aria-checked", "true")

        page.locator('[data-ai-id="appearance:mode:light"]').click()
        expect(html).to_have_attribute("data-theme", "light", timeout=10_000)

        # The preference lives in localStorage and is restored before first paint, so a
        # reload has to keep it — that is the difference between "setting" and "remembering".
        page.reload()
        expect(page.locator('[data-ai-id="platform-info:appearance"]')).to_be_visible(timeout=30_000)
        expect(page.locator("html")).to_have_attribute("data-accent", "green")
        expect(page.locator("html")).to_have_attribute("data-theme", "light")
        screenshot(page, "appearance-settings")
    finally:
        # Leave the browser as it was: this file is a per-browser preference and the next
        # case would otherwise start in the colours this one chose.
        page.locator('[data-ai-id="platform-info:appearance"]').wait_for(timeout=30_000)
        page.locator(f'[data-ai-id="appearance:accent:{original_accent}"]').click()
        page.locator(f'[data-ai-id="appearance:mode:{original_mode}"]').click()
