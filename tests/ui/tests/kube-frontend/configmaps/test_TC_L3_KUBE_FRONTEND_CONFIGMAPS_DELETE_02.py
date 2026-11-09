from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_DELETE_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02 删除并刷新：确认后行消失。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready":
        pytest.skip("没有可删除的行")

    target = configmaps_page.row_names()[0]
    configmaps_page.page.once("dialog", lambda dialog: dialog.accept())
    configmaps_page.delete_row(target)
    configmaps_page.wait_ready()

    assert target not in configmaps_page.row_names()
