from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_01(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-01 监控告警：告警策略在没有数据时显示空态，而不是错误面板。"""

    ui = monitoring_page
    if ui.has_data("alertingrules"):
        pytest.skip(f"项目里已经有告警策略，无法验证空态")

    ui.open("alertingrules")
    ui.wait_ready("alertingrules")

    assert ui.state("alertingrules") == "empty", f"expected an empty state, got {ui.state('alertingrules')!r}"
    # An empty list must not render a header row: a head above "no data" reads as a
    # table whose rows failed to load.
    assert ui.surface("alertingrules").locator("thead").count() == 0
    text = ui.surface("alertingrules").inner_text()
    assert "暂无" in text, text
    screenshot(ui.page, "alertingrules-empty")
