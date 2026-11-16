from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

TENANT = '/kapis/tenant.kubesphere.io/v1alpha2'
STORE = '/kapis/openpitrix.io/v1'


def _items(api, path: str) -> list[dict]:
    status, body = api.request('GET', path)
    if status != 200 or not isinstance(body, dict):
        return []
    return body.get('items') or []


def _select(page, trigger_id: str, contains: str) -> None:
    page.locator(f'[data-ai-id="{trigger_id}"]').click()
    option = page.locator('[role="option"]').filter(has_text=contains).first
    expect(option).to_be_visible(timeout=20_000)
    option.click()


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_INSTALL_03(page, ui_config, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-03 企业空间与项目的有效组合。"""

    from helpers.api import ApiClient

    api = ApiClient(ui_config.app, session_token)
    workspaces = [str((item.get('metadata') or {}).get('name') or '') for item in _items(api, f'{TENANT}/workspaces?limit=-1')]
    projects = {
        name: [str((item.get('metadata') or {}).get('name') or '') for item in _items(api, f'{TENANT}/workspaces/{name}/namespaces?limit=-1')]
        for name in workspaces
    }
    empty = [name for name in workspaces if not projects[name]]
    filled = [name for name in workspaces if projects[name]]
    if not filled:
        pytest.skip('没有带项目的企业空间，无法验证组合回落')

    apps = _items(api, f'{STORE}/apps?limit=5&page=1')
    app_id = ''
    if apps:
        # The store list returns a flat shape (`app_id` at the top level), not a CRD envelope.
        app_id = str(apps[0].get('app_id') or ((apps[0].get('spec') or {}).get('app_id')) or '')
    if not app_id:
        pytest.skip('商店里没有应用，安装弹窗无法打开')

    target = filled[0]
    page.goto(f'{ui_config.app}/kube-frontend/apps/{app_id}', wait_until='domcontentloaded')
    expect(page.locator('[data-ai-id="app-detail:surface"]')).to_be_visible(timeout=60_000)
    page.locator('[data-ai-id="app-detail:install"]').click()
    expect(page.locator('[data-ai-id="app-detail:install-dialog"]')).to_be_visible(timeout=20_000)

    writes: list[str] = []
    page.on('request', lambda request: writes.append(request.url) if request.method == 'POST' and 'applications' in request.url else None)

    # Select the workspace that has projects: the dialog must fall back to its first project.
    _select(page, 'app-detail:install-workspace', target)
    page.wait_for_timeout(2500)
    project_trigger = page.locator('[data-ai-id="app-detail:install-project"]')
    expect(project_trigger).to_be_visible(timeout=20_000)
    expect(project_trigger).to_contain_text(projects[target][0], timeout=20_000)

    # Now switch to a workspace without projects: the project must be cleared, not kept.
    if empty:
        _select(page, 'app-detail:install-workspace', empty[0])
        page.wait_for_timeout(2000)
        text = project_trigger.inner_text().strip()
        assert projects[target][0] not in text, f'切换企业空间后仍保留上一个空间的项目：{text}'

        page.locator('[data-ai-id="app-detail:install-name"]').fill('tc-e2e-combo-check')
        page.locator('[data-ai-id="app-detail:install-submit"]').click()
        expect(page.locator('[data-ai-id="app-detail:install-error"]')).to_contain_text('项目', timeout=20_000)
        assert writes == [], f'本地校验失败却发出了创建请求：{writes}'

    screenshot(page, 'app-install-workspace-project')

