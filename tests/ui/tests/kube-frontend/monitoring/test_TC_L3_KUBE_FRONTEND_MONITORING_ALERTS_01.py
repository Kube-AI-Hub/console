from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_ALERTS_01(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01 监控告警：告警消息在没有数据时显示空态，而不是错误面板。"""

    ui = monitoring_page
    if ui.has_data("alerts"):
        pytest.skip(f"项目里已经有告警消息，无法验证空态")

    ui.open("alerts")
    ui.wait_ready("alerts")

    assert ui.state("alerts") == "empty", f"expected an empty state, got {ui.state('alerts')!r}"
    # An empty list must not render a header row: a head above "no data" reads as a
    # table whose rows failed to load.
    assert ui.surface("alerts").locator("thead").count() == 0
    text = ui.surface("alerts").inner_text()
    assert "暂无" in text, text
    screenshot(ui.page, "alerts-empty")
