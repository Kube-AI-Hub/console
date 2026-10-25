from __future__ import annotations

import pytest

from helpers.contrast import untranslated_keys

pytestmark = pytest.mark.ui

MISSING_POD = "kube-ai-hub-not-exist"


@pytest.mark.point
def test_TC_L3_CONSOLE_CORE_RESOURCE_DETAIL_NOT_FOUND_01(
    detail_page, ui_config, screenshot
):
    """TC-L3-CONSOLE-CORE-RESOURCE_DETAIL-NOT_FOUND-01 不存在：中文提示 + 回退列表。"""
    detail_page.open_missing_pod(MISSING_POD)

    detail_page.wait_for_list(timeout_ms=15_000)
    assert detail_page.current_path.endswith(
        "/clusters/default/projects/agent-platform/pods"
    ), detail_page.current_path

    notice = detail_page.wait_for_not_found_notice()
    assert notice.get("title") == "资源不存在", notice
    assert MISSING_POD in notice.get("content", ""), notice

    # 后端原文不允许出现在页面上（提示标题/正文都走 i18n）。
    assert detail_page.raw_not_found_texts == [], detail_page.raw_not_found_texts
    assert untranslated_keys(detail_page.page) == []

    screenshot(detail_page.page, "missing-pod-not-found")
