from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_EDIT_01(cluster_configmaps_page, page, cluster_configmaps_edit_fixture, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01 编辑写入对象所属项目。"""
    project, name, other = cluster_configmaps_edit_fixture

    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()
    cluster_configmaps_page.open_row_menu(project, name)
    cluster_configmaps_page.click_row_action("编辑设置")

    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    screenshot(page, "cluster-edit-settings")
