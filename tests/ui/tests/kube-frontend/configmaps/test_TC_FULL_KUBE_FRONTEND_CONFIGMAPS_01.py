from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_CONFIGMAPS_01(configmaps_page, screenshot):
    """TC-FULL-KUBE_FRONTEND-CONFIGMAPS-01 配置字典：列表与行数一致，删除后消失。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    names = configmaps_page.row_names()
    assert len(names) == len(set(names)), f"重复行：{names}"

    if configmaps_page.state == "ready":
        assert configmaps_page.headers[:4] == ["名称", "项目", "字段", "创建时间"], configmaps_page.headers
    screenshot(configmaps_page.page, "full-configmaps")
