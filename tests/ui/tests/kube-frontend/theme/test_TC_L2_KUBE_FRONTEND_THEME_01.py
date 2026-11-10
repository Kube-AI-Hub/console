from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

TOGGLE = 'button[aria-label*="深浅色"]'


def theme_of(page) -> str | None:
    return page.evaluate("() => document.documentElement.getAttribute('data-theme')")


@pytest.mark.core
def test_TC_L2_KUBE_FRONTEND_THEME_01(page, ui_config, configmaps_page, screenshot):
    """TC-L2-KUBE-FRONTEND-THEME-01 切换深浅色并在刷新后保持。"""

    configmaps_page.url = f"{ui_config.base_url}/kube-frontend/system-workspace/clusters/host/projects/kube-frontend-demo/configmaps"
    configmaps_page.open()
    configmaps_page.wait_ready()

    # Clear the stored choice and reload, so the run starts from the default
    # rather than from whatever an earlier case left behind.
    page.evaluate("() => localStorage.removeItem('ai-kit-theme')")
    page.reload(wait_until="domcontentloaded")
    configmaps_page.wait_ready()

    assert theme_of(page) == "dark"
    assert page.evaluate("() => document.documentElement.getAttribute('data-accent')") == "violet"
    screenshot(page, "theme-dark")

    toggle = page.locator(TOGGLE)
    expect(toggle).to_be_visible()
    toggle.click()
    expect(page.locator("html")).to_have_attribute("data-theme", "light")
    assert toggle.get_attribute("aria-pressed") == "false"
    screenshot(page, "theme-light")

    # Reload: the attribute must be right on the first frame, not after React.
    # `wait_for_url` with `domcontentloaded` samples before hydration finishes.
    page.reload(wait_until="domcontentloaded")
    assert theme_of(page) == "light"
    configmaps_page.wait_ready()
    screenshot(page, "theme-light-after-reload")
