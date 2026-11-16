from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: (view segment, page key, hideable column to toggle)
VIEWS = (
    ('store', 'apps', 'workspace'),
    ('categories', 'categories', 'appTotal'),
    ('reviews', 'reviews', 'reviewer'),
)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_MANAGE_02(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-MANAGE-02 应用商店管理三个视图的显示列与刷新。"""

    app = ui_config.app.rstrip('/')

    for view, key, column in VIEWS:
        # Each table lives at its own URL; navigating keeps one open dropdown from covering
        # the next tab (clicking the tab row hit the portal and timed out).
        page.goto(f'{app}/kube-frontend/apps-manage/{view}', wait_until='domcontentloaded')
        expect(page.locator(f'[data-ai-id="store-manage:{view}:surface"]').last).to_be_visible(timeout=60_000)
        page.wait_for_timeout(1500)

        trigger = page.locator(f'[data-ai-id="store-manage:{key}:columns"]')
        expect(trigger).to_have_count(1, timeout=30_000)

        before = page.locator('thead th').count()
        trigger.first.click()
        item = page.locator(f'[data-ai-id="store-manage:{key}:columns:{column}"]')
        expect(item).to_have_count(1, timeout=20_000)
        item.first.click()
        page.wait_for_timeout(700)

        after = page.locator('thead th').count()
        assert after == before - 1, f'{key} 取消勾选后表头未减少：{before} -> {after}'
        stored = page.evaluate(f"() => localStorage.getItem('kube-frontend.columns.store-manage:{key}')")
        assert stored is not None and column not in stored, f'{key} 选择未持久化：{stored}'

        # The chooser stays open after a toggle (closeOnSelect is off), so close it before
        # reopening: clicking the trigger again would be a click on an already-open menu.
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        page.locator(f'[data-ai-id="store-manage:{key}:columns"]').first.click()
        page.locator(f'[data-ai-id="store-manage:{key}:columns:reset"]').first.click()
        page.wait_for_timeout(700)
        assert page.locator('thead th').count() == before, f'{key} 重置后未恢复全部列'
        page.keyboard.press('Escape')

    screenshot(page, 'store-manage-columns')
