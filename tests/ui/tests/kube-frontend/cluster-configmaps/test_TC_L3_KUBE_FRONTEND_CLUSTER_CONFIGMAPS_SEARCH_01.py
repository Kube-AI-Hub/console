from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_SEARCH_01(cluster_configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-SEARCH-01 按名称搜索。"""
    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    keys = cluster_configmaps_page.row_keys
    assert keys, "列表为空"
    # A substring of a real name, so the search is guaranteed to match something.
    name = keys[0].split("/", 1)[1]
    needle = name[: max(3, len(name) // 2)]

    cluster_configmaps_page.search(needle)
    cluster_configmaps_page.wait_ready()

    # A new query for this page takes ~25s (it lists every project), and the table keeps
    # the previous rows until it lands. Poll for the filtered set instead of sampling
    # once, otherwise the assertion reads rows from before the search.
    for _ in range(60):
        matched = cluster_configmaps_page.row_keys
        if matched and all(needle in key.split("/", 1)[1] for key in matched):
            break
        cluster_configmaps_page.page.wait_for_timeout(1500)
    assert matched, f"搜索 {needle!r} 没有结果"
    assert all(needle in key.split("/", 1)[1] for key in matched), matched

    screenshot(cluster_configmaps_page.page, "cluster-search")
