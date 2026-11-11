from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_DETAIL_01(cluster_configmaps_page, page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01 详情按项目定位。"""
    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    keys = cluster_configmaps_page.row_keys
    assert keys, "列表为空"
    project, name = keys[0].split("/", 1)

    cluster_configmaps_page.open_detail(project, name)
    expect(cluster_configmaps_page.detail_surface).to_be_visible(timeout=15_000)

    # The namespace rides in the query string because the name alone is ambiguous.
    assert f"namespace={project}" in page.url, page.url
    expect(page.get_by_role("heading", name=name)).to_be_visible()

    screenshot(page, "cluster-detail")
