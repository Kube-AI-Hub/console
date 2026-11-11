from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_LIST_01(cluster_configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01 列表默认视图。"""
    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    assert cluster_configmaps_page.headers == ["名称", "项目", "字段", "创建时间"]
    keys = cluster_configmaps_page.row_keys
    assert keys, "列表为空"
    # Row handles are `<project>/<name>`; a part without a slash means the page
    # fell back to the project-level row key and lost the project.
    assert all(len(key.split("/", 1)) == 2 and key.split("/", 1)[0] for key in keys), keys

    screenshot(cluster_configmaps_page.page, "cluster-list-default")
