from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: (tab value, storage key, hideable column to toggle)
TABS = (
    ('cluster', 'cluster-gateways:cluster', 'namespace'),
    ('project', 'cluster-gateways:project', 'type'),
)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_GATEWAYS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02 集群网关双页签的显示列。"""

    ui = cluster_management_page
    origin = ui.base_url.rstrip('/')
    ui.page.goto(f'{origin}/kube-frontend/clusters/{ui.cluster}/gateways', wait_until='domcontentloaded')
    surface = ui.page.locator('[data-ai-id="cluster-gateways:surface"]').last
    expect(surface).to_be_visible(timeout=60_000)

    headers_before: dict[str, int] = {}

    for tab, storage, column in TABS:
        ui.page.locator(f'[data-ai-id="cluster-gateways:tab:{tab}"]').first.click()
        ui.page.wait_for_timeout(2500)

        trigger = ui.page.locator(f'[data-ai-id="cluster-gateways:{tab}:columns"]')
        expect(trigger).to_have_count(1, timeout=30_000)
        headers_before[tab] = ui.page.locator('thead th').count()

        trigger.first.click()
        item = ui.page.locator(f'[data-ai-id="cluster-gateways:{tab}:columns:{column}"]')
        expect(item).to_have_count(1, timeout=20_000)
        item.first.click()
        ui.page.wait_for_timeout(700)
        ui.page.keyboard.press('Escape')

        after = ui.page.locator('thead th').count()
        if headers_before[tab] > 0:
            assert after == headers_before[tab] - 1, f'{tab} 页签取消勾选后表头未减少：{headers_before[tab]} -> {after}'
        else:
            # No gateway in this tab on this cluster: the chooser still works, but there is no
            # table header to count — the stored choice is the observable effect.
            assert after == 0
        stored = ui.page.evaluate(f"() => localStorage.getItem('kube-frontend.columns.{storage}')")
        assert stored is not None and column not in stored, f'{tab} 页签的选择未持久化：{stored}'

    # The two tabs are independent: each has its own stored set.
    first = ui.page.evaluate("() => localStorage.getItem('kube-frontend.columns.cluster-gateways:cluster')")
    second = ui.page.evaluate("() => localStorage.getItem('kube-frontend.columns.cluster-gateways:project')")
    assert first != second, f'两个页签共用了同一份选择：{first}'

    # Reset both so a later run starts from the default.
    for tab, _storage, _column in TABS:
        ui.page.locator(f'[data-ai-id="cluster-gateways:tab:{tab}"]').first.click()
        ui.page.wait_for_timeout(1500)
        ui.page.locator(f'[data-ai-id="cluster-gateways:{tab}:columns"]').first.click()
        ui.page.locator(f'[data-ai-id="cluster-gateways:{tab}:columns:reset"]').first.click()
        ui.page.wait_for_timeout(600)
        ui.page.keyboard.press('Escape')

    screenshot(ui.page, 'cluster-gateways-columns')

