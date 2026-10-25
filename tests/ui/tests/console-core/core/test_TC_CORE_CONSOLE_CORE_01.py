from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

POD_LIST_SUFFIX = "/clusters/default/projects/agent-platform/pods"


@pytest.mark.core
def test_TC_CORE_CONSOLE_CORE_01(detail_page, ui_config, screenshot):
    """TC-CORE-CONSOLE_CORE-01 详情页入口：侧栏与页签渲染，不出现未翻译 key。"""
    detail_page.open_pod_list()
    pod = detail_page.first_pod_name
    assert pod, "Pod 列表没有数据行"

    detail_page.open_pod_detail(pod)
    detail_page.wait_for_detail(pod)

    assert detail_page.detail_title == pod, detail_page.detail_title
    assert detail_page.current_path.endswith(f"/pods/{pod}/resource-status")

    screenshot(detail_page.page, "pod-detail-entry")
