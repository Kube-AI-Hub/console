from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PLATFORM_SETTINGS_NOTIFICATIONS_01(platform_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-NOTIFICATIONS-01 通知渠道：五行状态与 Secret 一致。"""

    ui = platform_settings_page
    secrets = ui.configured_channels()

    ui.open("notifications")
    ui.wait_ready("notifications")

    rows = ui.channel_rows()
    assert [key for key, _ in rows] == ["mail", "dingtalk", "wecom", "slack", "webhook"], rows

    for key, text in rows:
        configured = f"{key}s" in secrets
        expected = "已配置" if configured else "未配置"
        assert expected in text, (key, text, expected, secrets[:5])
    screenshot(ui.page, "platform-settings-notifications")
