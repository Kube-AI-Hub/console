from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_CREATE_01(cluster_configmaps_page, page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01 创建必须选项目。"""
    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    cluster_configmaps_page.create_button.click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()

    # With no project chosen the first step cannot be left; the cluster has no
    # route namespace to inherit one from.
    name_input = dialog.get_by_label("名称")
    name_input.fill("cluster-create-case")
    dialog.get_by_role("button", name="下一步").click()
    expect(dialog.get_by_text("请选择项目")).to_be_visible()

    screenshot(page, "cluster-create")
