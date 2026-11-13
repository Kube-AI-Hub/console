from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PLATFORM_SETTINGS_INFO_01(platform_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01 平台信息：三行属性。"""

    ui = platform_settings_page
    ui.open("info")
    ui.wait_ready("info")

    labels = ui.info_labels()
    assert labels == ["平台名称", "平台描述", "控制台地址"], labels

    # A value may legitimately be `-`: this cluster's kubesphere.yaml has no `console`
    # section, and the page must say "not configured" rather than fail or render blank.
    values = [ui.page.locator('[data-ai-id="platform-settings:info"] dd').nth(i).inner_text().strip() for i in range(3)]
    assert all(value for value in values), values
    screenshot(ui.page, "platform-settings-info")
