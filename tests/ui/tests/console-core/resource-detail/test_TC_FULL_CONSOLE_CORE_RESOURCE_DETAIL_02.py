from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

MISSING_POD = "kube-ai-hub-not-exist"


@pytest.mark.full
def test_TC_FULL_CONSOLE_CORE_RESOURCE_DETAIL_02(detail_page, ui_config, screenshot):
    """TC-FULL-CONSOLE-CORE-RESOURCE_DETAIL-02 不存在时：结束加载、中文提示、回到列表。"""
    detail_page.open_missing_pod(MISSING_POD)
    detail_page.wait_for_list(timeout_ms=15_000)

    assert detail_page.current_path.endswith(
        "/clusters/default/projects/agent-platform/pods"
    ), detail_page.current_path

    notice = detail_page.wait_for_not_found_notice()
    assert notice.get("title") == "资源不存在", notice
    assert MISSING_POD in notice.get("content", ""), notice

    screenshot(detail_page.page, "missing-pod-back-to-list")
