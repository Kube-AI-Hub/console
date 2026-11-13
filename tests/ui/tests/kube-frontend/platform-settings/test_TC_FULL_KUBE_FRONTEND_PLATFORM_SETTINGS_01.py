from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_PLATFORM_SETTINGS_01(platform_settings_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01 平台设置：平台信息与邮件渠道切换且无项目工作区栏。"""

    ui = platform_settings_page
    ui.open("info")
    ui.wait_ready("info")
    assert ui.active_tab() == "area-tabs:info"
    assert ui.workspace_bar_count == 0, "platform pages must not render the project workspace bar"

    ui.page.wait_for_load_state("networkidle")
    ui.page.wait_for_timeout(300)

    documents: list[str] = []
    ui.page.on("request", lambda r: documents.append(r.url) if r.resource_type == "document" else None)

    ui.page.locator('[data-ai-id="area-tabs:mail"]').click()
    expect(ui.surface("mail")).to_be_visible()
    ui.wait_ready("mail")
    assert ui.active_tab() == "area-tabs:mail"
    assert ui.workspace_bar_count == 0

    ui.page.locator('[data-ai-id="area-tabs:info"]').click()
    expect(ui.surface("info")).to_be_visible()
    ui.wait_ready("info")
    assert ui.active_tab() == "area-tabs:info"

    assert documents == [], f"tab switching reloaded the document: {documents}"
    screenshot(ui.page, "platform-settings-tabs")
