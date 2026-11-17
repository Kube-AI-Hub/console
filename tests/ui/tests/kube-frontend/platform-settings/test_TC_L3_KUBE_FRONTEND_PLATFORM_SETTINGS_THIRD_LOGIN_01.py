from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PLATFORM_SETTINGS_THIRD_LOGIN_01(platform_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01 第三方登录状态页。"""

    ui = platform_settings_page
    status, body = ui.api.request("GET", "/kapis/iam.kubesphere.io/v1alpha2/identityproviders?limit=-1")
    api_available = status == 200 and isinstance(body, dict)

    ui.page.goto(f'{ui.base_url}/kube-frontend/settings/third-login', wait_until="domcontentloaded")
    surface = ui.page.locator('[data-ai-id="third-login:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    if api_available:
        providers = [str((item.get("metadata") or {}).get("name") or "") for item in body.get("items") or []]
        if providers:
            panel = ui.page.locator('[data-ai-id="third-login:providers"]')
            expect(panel).to_be_visible(timeout=20_000)
            for name in providers:
                expect(ui.page.locator(f'[data-ai-id="third-login:provider:{name}"]')).to_be_visible(timeout=20_000)
        else:
            expect(ui.page.locator('[data-ai-id="third-login:empty"]')).to_be_visible(timeout=20_000)
    else:
        expect(ui.page.locator('[data-ai-id="third-login:unavailable"]')).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="third-login:providers"]')).to_have_count(0)

    # No credential editor exists: the old Configure dialogs never submitted a request.
    expect(ui.page.locator('[data-ai-id="third-login:hint"]')).to_be_visible()
    screenshot(ui.page, "third-login")
