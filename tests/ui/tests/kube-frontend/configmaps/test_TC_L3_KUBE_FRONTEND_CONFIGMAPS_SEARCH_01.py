from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_SEARCH_01(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-SEARCH-01 按名称搜索：结果只含匹配项。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready":
        pytest.skip("没有数据可搜索")

    target = configmaps_page.row_names()[0]
    configmaps_page.search(target)

    assert configmaps_page.state in {"ready", "empty"}
    if configmaps_page.state == "ready":
        assert all(target in name for name in configmaps_page.row_names())
    screenshot(configmaps_page.page, "search")
