from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_07(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-07 配置字典列表的刷新与空态出口。"""

    seeded_configmaps["create"]("refresh-a", {"key-a": "1"})
    configmaps_page.open()
    configmaps_page.wait_ready()

    refresh = configmaps_page.page.locator('[data-ai-id="configmaps:refresh"]')
    expect(refresh).to_be_visible(timeout=20_000)

    # Created behind the page's back: the row can only appear if the button refetches.
    late = seeded_configmaps["create"]("refresh-late", {"key-b": "2"})
    expect(configmaps_page.page.locator(f'[data-ai-row="{late}"]')).to_have_count(0)
    refresh.click()
    expect(configmaps_page.page.locator(f'[data-ai-row="{late}"]')).to_be_visible(timeout=30_000)

    # The empty state offers a way out instead of a dead end.
    search = configmaps_page.page.locator('[data-ai-id="configmaps:search"]').last
    search.fill("zzz-no-such-configmap")
    expect(configmaps_page.page.locator("[data-ai-row]")).to_have_count(0, timeout=30_000)
    clear = configmaps_page.page.get_by_role("button", name="清空搜索与筛选")
    expect(clear).to_be_visible(timeout=20_000)
    clear.click()
    expect(configmaps_page.page.locator("[data-ai-row]").first).to_be_visible(timeout=30_000)
    assert search.input_value() == ""
    screenshot(configmaps_page.page, "configmaps-refresh")
