from __future__ import annotations

import json

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

STORAGE_KEY = "kube-frontend.columns.workloads:pods"
SURFACE = '[data-ai-id="pods:surface"]'
NODE_HEADER = "所在节点"


def _headers(surface) -> list[str]:
    return [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_COLUMN_VISIBILITY_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01 列表列显隐：隐藏、持久化与恢复。"""

    ui = app_workloads_page
    try:
        ui.page.goto(ui.url("pods"))
        ui.page.evaluate("key => localStorage.removeItem(key)", STORAGE_KEY)
        ui.page.reload()

        surface = ui.page.locator(SURFACE)
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        headers = _headers(surface)
        for expected in ("名称", "状态", NODE_HEADER):
            assert expected in headers, (expected, headers)

        # The chooser is the ai-kit one: trigger and items carry the ids derived from
        # schema.columnVisibility.aiId, so no page-specific selector is needed.
        trigger = ui.page.locator('[data-ai-id="pods:columns"]')
        expect(trigger).to_be_visible()
        trigger.click()
        item = ui.page.locator('[data-ai-id="pods:columns:node"]')
        expect(item).to_be_visible()
        item.click()

        expect(surface.locator("thead th", has_text=NODE_HEADER)).to_have_count(0, timeout=10_000)
        headers = _headers(surface)
        assert NODE_HEADER not in headers, headers
        assert "名称" in headers, headers

        stored = ui.page.evaluate("key => localStorage.getItem(key)", STORAGE_KEY)
        assert stored, "隐藏列后应写入 localStorage"
        keys = json.loads(stored)
        assert "node" not in keys, keys
        assert "name" in keys, keys

        # A refresh must keep the choice, not merely the current render.
        ui.page.reload()
        surface = ui.page.locator(SURFACE)
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        expect(surface.locator("thead th", has_text=NODE_HEADER)).to_have_count(0, timeout=10_000)
        assert "名称" in _headers(surface)

        # Re-checking the column restores it, and "all visible" is the default again:
        # the stored preference is removed rather than left as a full array.
        ui.page.locator('[data-ai-id="pods:columns"]').click()
        recheck = ui.page.locator('[data-ai-id="pods:columns:node"]')
        expect(recheck).to_be_visible()
        recheck.click()
        expect(surface.locator("thead th", has_text=NODE_HEADER)).to_have_count(1, timeout=10_000)
        assert NODE_HEADER in _headers(surface)
        assert ui.page.evaluate("key => localStorage.getItem(key)", STORAGE_KEY) is None
        screenshot(ui.page, "column-visibility")
    finally:
        # The browser context is session-scoped; leave no preference behind for other cases.
        ui.page.evaluate("key => localStorage.removeItem(key)", STORAGE_KEY)
