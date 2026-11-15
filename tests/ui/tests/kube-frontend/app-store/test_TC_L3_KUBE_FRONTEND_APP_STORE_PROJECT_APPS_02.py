from __future__ import annotations

import pytest
from playwright.sync_api import expect

from project_apps_helpers import PROJECT, WS, release_name, releases, remove_release, unique_name

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_PROJECT_APPS_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02 项目内应用：安装（目标锁定 + values）。"""

    ui = app_workloads_page
    assert ui.api is not None
    origin = ui.base.split('/kube-frontend/')[0]
    name = unique_name()
    writes: list[str] = []
    created = False
    try:
        ui.page.goto(f'{ui.base}/applications')
        surface = ui.page.locator('[data-ai-id="installed-apps:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

        ui.page.on('request', lambda request: writes.append(f'{request.method} {request.url}') if request.method == 'POST' and 'openpitrix' in request.url else None)

        ui.page.locator('[data-ai-id="installed-apps:install"]').click()
        picker = ui.page.locator('[data-ai-id="installed-apps:pick"]').last
        expect(picker).to_be_visible(timeout=30_000)
        first_app = ui.page.locator('[data-ai-id^="installed-apps:pick-app:"]').first
        expect(first_app).to_be_visible(timeout=60_000)
        first_app.click()

        dialog = ui.page.locator('[data-ai-id="app-detail:install-dialog"]').last
        expect(dialog).to_be_visible(timeout=60_000)
        # The target is decided by the page: both selects must already carry it and be read-only.
        workspace_select = ui.page.locator('[data-ai-id="app-detail:install-workspace"]').last
        project_select = ui.page.locator('[data-ai-id="app-detail:install-project"]').last
        expect(workspace_select).to_be_disabled(timeout=30_000)
        expect(project_select).to_be_disabled(timeout=30_000)

        name_input = dialog.locator('input[data-ai-id="app-detail:install-name"]') if dialog.locator('input[data-ai-id="app-detail:install-name"]').count() else None
        target = name_input if name_input is not None else dialog.locator('input').first
        target.fill(name)
        ui.page.locator('[data-ai-id="app-detail:install-submit"]').click()

        expect(ui.page.locator('[data-ai-id="app-detail:install-success"]').last).to_be_visible(timeout=120_000)
        created = True
        ui.page.keyboard.press('Escape')

        expect(surface.locator('tbody tr[data-ai-row]').filter(has_text=name)).to_have_count(1, timeout=120_000)
        matches = [item for item in releases(ui.api) if release_name(item) == name]
        assert matches, 'release 没有出现在项目集合里'
        assert str(((matches[0].get('cluster') or {}).get('namespace')) or PROJECT) == PROJECT
        assert [entry for entry in writes if entry.endswith('/applications')], f'期望一次创建请求，实际 {writes}'
        screenshot(ui.page, 'project-apps-installed')
    finally:
        remove_release(ui.api, name)
