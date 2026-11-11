from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_01(cluster_configmaps_page, screenshot):
    """TC-FULL-KUBE_FRONTEND-CLUSTER_CONFIGMAPS-01 集群配置字典与 kubectl 逐项核对。"""
    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    assert cluster_configmaps_page.headers == ["名称", "项目", "字段", "创建时间"]
    # The whole point of this page: rows come from more than one project.
    assert cluster_configmaps_page.row_keys, "列表为空，无法核对跨项目数据"
    assert all("/" in key for key in cluster_configmaps_page.row_keys), cluster_configmaps_page.row_keys

    screenshot(cluster_configmaps_page.page, "cluster-configmaps-list")
