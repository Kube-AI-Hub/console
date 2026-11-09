from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_MOBILE_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-MOBILE-02 窄屏列折叠：键与创建时间不显示。"""

    configmaps_page.page.set_viewport_size({"width": 375, "height": 812})
    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready":
        pytest.skip("没有数据可断言列折叠")

    headers = configmaps_page.headers
    assert "键" not in headers, headers
    assert "创建时间" not in headers, headers
    assert "名称" in headers, headers
    screenshot(configmaps_page.page, "mobile-list")
