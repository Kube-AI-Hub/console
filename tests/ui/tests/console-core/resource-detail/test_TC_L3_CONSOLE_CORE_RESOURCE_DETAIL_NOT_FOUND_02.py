from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CONSOLE_CORE_RESOURCE_DETAIL_NOT_FOUND_02(
    detail_page, ui_config, screenshot
):
    """TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-02 存在时不误报：无提示、无跳转。"""
    detail_page.open_pod_list()
    pod = detail_page.first_pod_name
    assert pod, "Pod 列表没有数据行"

    detail_page.open_pod_detail(pod)
    detail_page.wait_for_detail(pod)

    # 提示条最多 6 秒后消失，等 5 秒足够覆盖「误报」这一窗口。
    detail_page.page.wait_for_timeout(5_000)

    assert detail_page.not_found_notices == []
    assert detail_page.current_path.endswith(f"/pods/{pod}/resource-status")
    assert detail_page.detail_title == pod

    screenshot(detail_page.page, "existing-pod-no-notice")
