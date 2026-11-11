from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_LIST_02(cluster_configmaps_page, page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02 项目筛选。"""
    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    projects = cluster_configmaps_page.row_projects
    assert projects, "列表为空"

    # Narrow to the first project seen, then widen again. The filter is a Select;
    # picking its option by accessible name keeps this independent of its markup.
    target = sorted(projects)[0]
    cluster_configmaps_page.surface.get_by_role("button", name="全部项目").first.click()
    page.get_by_role("option", name=target, exact=True).click()
    cluster_configmaps_page.wait_ready()

    assert cluster_configmaps_page.row_projects <= {target}, cluster_configmaps_page.row_projects

    cluster_configmaps_page.surface.get_by_role("button", name=target).first.click()
    page.get_by_role("option", name="全部项目", exact=True).click()
    cluster_configmaps_page.wait_ready()

    screenshot(page, "cluster-list-filter")
