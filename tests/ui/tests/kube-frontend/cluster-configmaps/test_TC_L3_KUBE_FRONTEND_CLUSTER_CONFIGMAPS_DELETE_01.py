from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_DELETE_01(cluster_configmaps_page, page, cluster_configmaps_edit_fixture, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01 删除按项目定位。"""
    project, name, other = cluster_configmaps_edit_fixture

    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    cluster_configmaps_page.delete_row(project, name)
    page.get_by_role("dialog").get_by_role("button", name="确定").click()
    cluster_configmaps_page.wait_ready()

    # The same name in another project must survive: the delete is addressed by
    # (project, name), not by name alone.
    keys = cluster_configmaps_page.row_keys
    assert f"{project}/{name}" not in keys, keys
    assert f"{other}/{name}" in keys, keys

    screenshot(page, "cluster-delete")
