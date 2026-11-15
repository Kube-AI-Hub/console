from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: (route segment, ai prefix, api fragment used to recognise the list request)
PAGES = (
    ('configmaps', 'configmaps', '/configmaps'),
    ('secrets', 'secrets', '/secrets'),
    ('serviceaccounts', 'serviceaccounts', '/serviceaccounts'),
    ('deployments', 'deployments', '/deployments'),
)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_08(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08 列表每页条数选择器（10/20/50/100）。"""

    ui = configmaps_page
    # The page object already holds the project console base for this cluster/workspace.
    base = ui.url.split('/configmaps')[0]

    checked = 0
    for segment, prefix, api_fragment in PAGES:
        # The project workspace URL is the same shape for all four lists.
        url = f'{base}/{segment}'
        requests: list[str] = []
        ui.page.on('request', lambda r: requests.append(r.url) if api_fragment in r.url and 'limit=' in r.url else None)

        ui.page.goto(url, wait_until='domcontentloaded')
        surface = ui.page.locator('[data-ai-id$=":surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

        trigger = ui.page.locator(f'[data-ai-id="{prefix}:page-size"]')
        expect(trigger).to_have_count(1, timeout=30_000)
        assert trigger.inner_text().strip() == '10', trigger.inner_text()

        requests.clear()
        trigger.click()
        option = ui.page.get_by_role('option', name='50', exact=True).first
        expect(option).to_be_visible(timeout=20_000)
        option.click()
        ui.page.wait_for_timeout(3000)

        sized = [url for url in requests if 'limit=50' in url]
        assert sized, f'{segment} 切换每页条数后没有发出 limit=50 的请求：{requests[-3:]}'
        assert 'page=1' in sized[-1], sized[-1]
        assert trigger.inner_text().strip() == '50', trigger.inner_text()
        checked += 1

    assert checked == len(PAGES), checked
    screenshot(ui.page, 'list-page-size')

