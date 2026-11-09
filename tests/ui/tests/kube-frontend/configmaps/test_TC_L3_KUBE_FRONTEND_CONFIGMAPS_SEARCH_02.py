from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_SEARCH_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-02 搜索无结果：进入 empty 态并显示空态文案。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    configmaps_page.search("no-such-configmap-zzz")
    assert configmaps_page.state == "empty", configmaps_page.state
    assert "暂无配置字典" in configmaps_page.page.inner_text("main")
