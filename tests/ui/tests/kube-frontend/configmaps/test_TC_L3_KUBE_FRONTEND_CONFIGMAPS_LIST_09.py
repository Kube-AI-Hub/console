from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: (ai prefix, path suffix after the console root, expects a limit=50 request)
PAGES = (
    ('alerts', '/kube-frontend/system-workspace/clusters/host/projects/default/alerts', True),
    ('alertingrules', '/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules', False),
    ('users', '/kube-frontend/access/users', True),
    ('members', '/kube-frontend/system-workspace/clusters/host/projects/default/members', True),
    ('networkpolicies', '/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies', False),
    ('federated-projects', '/kube-frontend/workspaces/system-workspace/federatedprojects', False),
    ('store-manage:apps', '/kube-frontend/apps-manage', True),
    ('image-builder', '/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder', True),
)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_09(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-09 每页条数选择器覆盖其余页面族。"""

    ui = access_control_page
    assert ui.api is not None
    origin = ui.base_url.split('/kube-frontend/')[0]

    for prefix, path, server_paged in PAGES:
        requests: list[str] = []
        ui.page.on('request', lambda r: requests.append(r.url) if 'limit=' in r.url and 'kube-frontend' not in r.url and '/api/' not in r.url else None)
        ui.page.goto(origin + path, wait_until='domcontentloaded')
        ui.page.wait_for_timeout(3500)

        trigger = ui.page.locator(f'[data-ai-id="{prefix}:page-size"]')
        expect(trigger).to_have_count(1, timeout=30_000)
        assert trigger.inner_text().strip() == '10', (prefix, trigger.inner_text())

        requests.clear()
        trigger.click()
        option = ui.page.get_by_role('option', name='50', exact=True).first
        expect(option).to_be_visible(timeout=20_000)
        option.click()
        ui.page.wait_for_timeout(3000)

        assert trigger.inner_text().strip() == '50', (prefix, trigger.inner_text())
        rows = ui.page.locator('tbody tr[data-ai-row]').count()
        if server_paged:
            sized = [url for url in requests if 'limit=50' in url]
            assert sized, f'{prefix} 切换后没有 limit=50 的请求：{requests[-3:]}'
            assert rows <= 50, (prefix, rows)
        else:
            # Client-paged: the page must slice by the selected size.
            assert rows <= 50, f'{prefix} 客户端分页仍渲染 {rows} 行（切片没跟随页大小）'

    screenshot(ui.page, 'list-page-size-coverage')

