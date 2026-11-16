from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: (ai prefix, route segment, storage key)
PAGES = (
    ('configmaps', 'configmaps', 'configmaps'),
    ('secrets', 'secrets', 'secrets'),
    ('serviceaccounts', 'serviceaccounts', 'serviceaccounts'),
    ('persistentvolumeclaims', 'persistentvolumeclaims', 'persistentvolumeclaims'),
)

COLUMN = 'project'


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_11(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-11 列表显示列。"""

    ui = configmaps_page
    base = ui.url.split('/configmaps')[0]

    for prefix, segment, storage in PAGES:
        ui.page.goto(f'{base}/{segment}', wait_until='domcontentloaded')
        surface = ui.page.locator(f'[data-ai-id="{prefix}:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

        trigger = ui.page.locator(f'[data-ai-id="{prefix}:columns"]')
        expect(trigger).to_have_count(1, timeout=30_000)

        headers = ui.page.locator('thead th')
        before = headers.count()
        trigger.first.click()

        # The chooser lists hideable columns only: the identity column must not be offered.
        expect(ui.page.locator(f'[data-ai-id="{prefix}:columns:reset"]')).to_have_count(1, timeout=20_000)
        assert ui.page.locator(f'[data-ai-id="{prefix}:columns:name"]').count() == 0, '名称列不应可隐藏'

        item = ui.page.locator(f'[data-ai-id="{prefix}:columns:{COLUMN}"]')
        if item.count() == 0:
            # A list without that column (e.g. cluster-scoped kinds) still proves the menu opened.
            ui.page.keyboard.press('Escape')
            continue

        item.first.click()
        ui.page.wait_for_timeout(700)
        after = ui.page.locator('thead th').count()
        assert after == before - 1, f'{prefix} 取消勾选后表头数未减少：{before} -> {after}'

        stored = ui.page.evaluate(f"() => localStorage.getItem('kube-frontend.columns.{storage}')")
        assert stored is not None and COLUMN not in stored, f'{prefix} 选择未持久化：{stored}'

        # The choice survives a reload.
        ui.page.reload(wait_until='domcontentloaded')
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)
        assert ui.page.locator('thead th').count() == before - 1, f'{prefix} 刷新后列没有保持隐藏'

        # Reset restores every column and clears the stored choice.
        ui.page.locator(f'[data-ai-id="{prefix}:columns"]').first.click()
        ui.page.locator(f'[data-ai-id="{prefix}:columns:reset"]').first.click()
        ui.page.wait_for_timeout(700)
        assert ui.page.locator('thead th').count() == before, f'{prefix} 重置后未恢复全部列'

    screenshot(ui.page, 'list-column-visibility')

