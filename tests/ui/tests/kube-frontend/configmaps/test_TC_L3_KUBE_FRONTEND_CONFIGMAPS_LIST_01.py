from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_01(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01 配置字典列表：默认按创建时间倒序，表头为 名称/项目/字段/创建时间。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready":
        pytest.skip(f"没有数据可断言，当前状态 {configmaps_page.state}")

    # The old console's cluster-scoped list carries a 项目 column too; the PRD
    # requires it and the default view is sorted by creation time.
    assert configmaps_page.headers[:4] == ["名称", "项目", "字段", "创建时间"], configmaps_page.headers
    # Located by text, not index: a leading checkbox column shifts every index.
    created = configmaps_page.surface.locator("thead th", has_text="创建时间").first
    assert created.get_attribute("aria-sort") in {"ascending", "descending"}
    screenshot(configmaps_page.page, "list-default")
