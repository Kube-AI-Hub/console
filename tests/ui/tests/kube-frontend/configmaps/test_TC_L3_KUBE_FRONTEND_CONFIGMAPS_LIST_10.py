from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_10(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-10 每页条数选择器收尾（告警消息/快照类/资源监控）。"""

    ui = cluster_management_page
    assert ui.api is not None
    origin = ui.base_url.rstrip('/')

    # Server-paged: cluster alert messages page through the aggregate collection.
    requests: list[str] = []
    ui.page.on('request', lambda r: requests.append(r.url) if 'limit=' in r.url and '/kapis/' in r.url and '/api/' not in r.url else None)
    ui.page.goto(f'{origin}/kube-frontend/clusters/{ui.cluster}/alerting-messages', wait_until='domcontentloaded')
    surface = ui.page.locator('[data-ai-id="cluster-alerting-messages:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

    trigger = ui.page.locator('[data-ai-id="cluster-alerting-messages:page-size"]')
    expect(trigger).to_have_count(1, timeout=30_000)
    assert trigger.inner_text().strip() == '20', trigger.inner_text()
    requests.clear()
    trigger.click()
    option = ui.page.get_by_role('option', name='50', exact=True).first
    expect(option).to_be_visible(timeout=20_000)
    option.click()
    ui.page.wait_for_timeout(3000)
    assert [url for url in requests if 'limit=50' in url], f'告警消息切换后没有 limit=50 请求：{requests[-3:]}'
    assert trigger.inner_text().strip() == '50', trigger.inner_text()

    # The other two lists: the picker must exist wherever a pager exists; a list that fits one
    # page renders no pager at all (same as the old console), so absence there is not a failure.
    for prefix, segment in (('cluster-snapshot-classes', 'volume-snapshot-classes'), ('cluster-resource-monitor', 'monitor-resource')):
        ui.page.goto(f'{origin}/kube-frontend/clusters/{ui.cluster}/{segment}', wait_until='domcontentloaded')
        ui.page.wait_for_timeout(3000)
        pager = ui.page.locator(f'[data-ai-id="{prefix}:page-size"]')
        if pager.count() == 0:
            # No pager: the list fits one page. Nothing to verify beyond it not rendering.
            continue
        pager.first.click()
        opt = ui.page.get_by_role('option', name='50', exact=True).first
        expect(opt).to_be_visible(timeout=20_000)
        opt.click()
        ui.page.wait_for_timeout(2000)
        assert pager.first.inner_text().strip() == '50', (prefix, pager.first.inner_text())
        assert ui.page.locator('tbody tr[data-ai-row]').count() <= 50

    screenshot(ui.page, 'list-page-size-tail')

