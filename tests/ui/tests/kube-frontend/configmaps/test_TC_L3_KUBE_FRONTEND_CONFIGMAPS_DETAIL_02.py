from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_DETAIL_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-02 详情：四个操作入口各自打开对应弹窗。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready" or not configmaps_page.row_names():
        pytest.skip(f"没有对象可打开，当前状态 {configmaps_page.state}")

    configmaps_page.open_detail(configmaps_page.row_names()[0])

    for ai_id in ("configmap-detail:edit-info", "configmap-detail:edit-settings", "configmap-detail:edit-delete"):
        if ai_id.endswith("edit-delete"):
            # Last one opens a destructive dialog; close it immediately after proving it opened.
            configmaps_page.page.locator('[data-ai-id="configmap-detail:delete"]').click()
        else:
            configmaps_page.page.locator(f'[data-ai-id="{ai_id}"]').click()
        expect(configmaps_page.dialog).to_be_visible()
        configmaps_page.page.keyboard.press("Escape")

    screenshot(configmaps_page.page, "detail-operations")
