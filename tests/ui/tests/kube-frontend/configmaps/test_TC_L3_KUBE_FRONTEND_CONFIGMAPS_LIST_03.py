from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_03(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03 翻页清空已选：批量删除回到禁用。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready":
        pytest.skip("没有可勾选的行")

    first = configmaps_page.row_names()[0]
    configmaps_page.select_row(first)
    expect(configmaps_page.bulk_delete).to_be_enabled()

    pager = configmaps_page.page.locator("nav[aria-label]").last
    buttons = pager.locator("button")
    if buttons.count() > 1:
        buttons.nth(1).click()
        configmaps_page.wait_ready()
        expect(configmaps_page.bulk_delete).to_be_disabled()
    else:
        pytest.skip("不足两页")
