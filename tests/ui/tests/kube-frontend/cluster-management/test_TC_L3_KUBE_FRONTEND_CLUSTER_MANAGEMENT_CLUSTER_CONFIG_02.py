from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: (ai prefix, route segment, default page size)
SERVER_PAGED = (
    ('cluster-configmaps', 'configmaps', '20'),
    ('cluster-secrets', 'secrets', '20'),
    ('cluster-serviceaccounts', 'serviceaccounts', '20'),
    ('cluster-networkpolicies', 'networkpolicies', '10'),
    ('ip-pools', 'ippools', '10'),
    ('cluster-pvc', 'persistentvolumeclaims', '20'),
)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_CONFIG_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02 集群侧列表每页条数选择器。"""

    ui = cluster_management_page
    assert ui.api is not None
    origin = ui.base_url.rstrip('/')

    for prefix, segment, default in SERVER_PAGED:
        requests: list[str] = []
        ui.page.on('request', lambda r: requests.append(r.url) if 'limit=' in r.url and 'kube-frontend' not in r.url and '/api/' not in r.url else None)
        ui.page.goto(f'{origin}/kube-frontend/clusters/{ui.cluster}/{segment}', wait_until='domcontentloaded')
        surface = ui.page.locator(f'[data-ai-id="{prefix}:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

        trigger = ui.page.locator(f'[data-ai-id="{prefix}:page-size"]')
        expect(trigger).to_have_count(1, timeout=30_000)
        assert trigger.inner_text().strip() == default, (prefix, trigger.inner_text())

        requests.clear()
        trigger.click()
        option = ui.page.get_by_role('option', name='50', exact=True).first
        expect(option).to_be_visible(timeout=20_000)
        option.click()

        # The list refetches: wait for the new request and for loading to clear before counting.
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)
        sized = [url for url in requests if 'limit=50' in url]
        assert sized, f'{prefix} 切换每页条数后没有 limit=50 的请求（页大小未进 queryKey？）：{requests[-3:]}'
        assert 'page=1' in sized[-1], sized[-1]
        assert trigger.inner_text().strip() == '50', trigger.inner_text()
        assert surface.locator('tbody tr[data-ai-row]').count() <= 50

    # Cluster storage classes: client-paged, so the table must show only the current page.
    ui.page.goto(f'{origin}/kube-frontend/clusters/{ui.cluster}/storageclasses', wait_until='domcontentloaded')
    sc_surface = ui.page.locator('[data-ai-id="storageclasses:surface"]').last
    expect(sc_surface).to_be_visible(timeout=30_000)
    expect(sc_surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)
    sc_trigger = ui.page.locator('[data-ai-id="storageclasses:page-size"]')
    expect(sc_trigger).to_have_count(1, timeout=30_000)
    total = sc_surface.locator('tbody tr[data-ai-row]').count()
    assert total <= 10, f'默认每页 10 条，实际渲染 {total} 行（客户端分页没有切片？）'

    screenshot(ui.page, 'cluster-list-page-size')

