from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L2_KUBE_FRONTEND_HELP_01(access_control_page, screenshot):
    """TC-L2-KUBE-FRONTEND-HELP-01 顶栏帮助菜单。"""

    ui = access_control_page
    ui.page.goto(f'{ui.base_url}/kube-frontend/', wait_until="domcontentloaded")
    help_button = ui.page.locator('[data-ai-id="shell:help-menu"]')
    expect(help_button).to_be_visible(timeout=60_000)
    assert (help_button.get_attribute("aria-label") or "") in ("帮助与文档", "Help and documentation")

    # Two entries, in the current language; the BFF defaults are the old console's
    # relative /kube-docs paths, so this deployment always has both.
    help_button.click()
    guide = ui.page.locator('[data-ai-id="shell:docs-guide"]')
    api = ui.page.locator('[data-ai-id="shell:docs-api"]')
    expect(guide).to_be_visible(timeout=20_000)
    expect(api).to_be_visible(timeout=20_000)

    with ui.page.context.expect_page() as popup_info:
        guide.click()
    popup = popup_info.value
    popup.wait_for_load_state("domcontentloaded", timeout=60_000)
    assert "/kube-docs/" in popup.url, popup.url
    # The docs site must not be able to reach back into the console window.
    assert popup.evaluate("() => window.opener") is None

    screenshot(ui.page, "help-menu")
