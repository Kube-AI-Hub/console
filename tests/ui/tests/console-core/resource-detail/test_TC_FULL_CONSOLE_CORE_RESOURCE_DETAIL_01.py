from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_CONSOLE_CORE_RESOURCE_DETAIL_01(detail_page, ui_config, screenshot):
    """TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-01 页签切换：地址栏同步、摘要常驻、无未翻译 key。"""
    detail_page.open_pod_list()
    pod = detail_page.first_pod_name
    assert pod, "Pod 列表没有数据行"

    detail_page.open_pod_detail(pod)
    detail_page.wait_for_detail(pod)

    for title, route in (
        ("资源状态", "resource-status"),
        ("元数据", "metadata"),
        ("事件", "events"),
    ):
        detail_page.click_tab(title)
        assert detail_page.current_path.endswith(f"/pods/{pod}/{route}"), (
            title,
            detail_page.current_path,
        )
        assert detail_page.detail_title == pod, title

    screenshot(detail_page.page, "pod-detail-events")
