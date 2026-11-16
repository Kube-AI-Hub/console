"""同源集成：登录态互通。"""

from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: Token keys either console has ever written. The unified build must leave exactly one.
TOKEN_KEYS = ("kah_token", "kubesphere-token")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_INTEGRATION_SESSION_01(browser, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01 一个 token 键，两边互通。"""

    origin = ui_config.app.rstrip("/")

    # A fresh context: the shared `page` fixture seeds several token keys on
    # purpose, which would make "only one key remains" untestable here.
    context = browser.new_context(viewport={"width": 1600, "height": 900}, locale="zh-CN", ignore_https_errors=True)
    page = context.new_page()
    try:
        # 1. Sign in on the old console (the flow the reader actually uses).
        page.goto(f"{origin}/login", wait_until="domcontentloaded")
        page.fill("input[name=username]", ui_config.username)
        page.fill("input[name=password]", ui_config.password)
        page.click("button:has-text('登录'), button[type=submit]")
        page.wait_for_url(lambda url: "/login" not in url, timeout=60_000)

        stored = page.evaluate("() => Object.keys(localStorage).filter((k) => k.includes('token'))")
        assert "kah_token" in stored, stored
        # A fresh context has no legacy key, so the old console must not create one.
        assert "kubesphere-token" not in stored, f"the legacy key must not be written: {stored}"
        assert "kah_token" in page.evaluate("() => document.cookie"), page.evaluate("() => document.cookie")

        # 2. The new console accepts it: no login form, workbench paints.
        page.goto(f"{origin}/kube-frontend/", wait_until="domcontentloaded")
        expect(page.locator('[data-ai-id="workbench:surface"]')).to_be_visible(timeout=60_000)
        assert page.locator('[data-ai-id="login:surface"]').count() == 0

        screenshot(page, "integration-session-shared")

        # 3. Signing out there ends the session here too.
        page.locator('[data-ai-id="shell:user-menu"]').click()
        page.get_by_role("menuitem", name="退出登录", exact=True).click()
        expect(page.locator('[data-ai-id="login:surface"]')).to_be_visible(timeout=30_000)
        assert page.evaluate("() => localStorage.getItem('kah_token')") is None
        assert "kah_token" not in page.evaluate("() => document.cookie"), "sign-out must clear the cookie too"

        # 4. And the old console no longer treats the browser as signed in.
        page.goto(f"{origin}/dashboard", wait_until="domcontentloaded")
        page.wait_for_url("**/login**", timeout=60_000)
    finally:
        context.close()
