from __future__ import annotations

import pytest
from playwright.sync_api import expect

from project_apps_helpers import PREFIX, PROJECT, WS, create_release, release_name, releases, remove_release, unique_name

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_PROJECT_APPS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-01 项目内应用：列表、行数与空态。"""

    ui = app_workloads_page
    assert ui.api is not None
    origin = ui.base.split('/kube-frontend/')[0]
    name = unique_name()
    created = False
    try:
        before = len(releases(ui.api))
        ui.page.goto(f'{ui.base}/applications')
        surface = ui.page.locator('[data-ai-id="installed-apps:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

        # An empty project must say so instead of drawing an empty table.
        if before == 0:
            expect(surface).to_have_attribute('data-ai-state', 'empty', timeout=30_000)
        else:
            expect(surface).to_have_attribute('data-ai-state', 'ready', timeout=30_000)

        # Create one release through the API, then the table must show exactly it.
        create_release(ui.api, name)
        created = True
        expect(surface.locator(f'tbody tr[data-ai-row]')).to_have_count(before + 1, timeout=120_000)
        headers = [value.strip() for value in surface.locator('thead th:visible').all_inner_texts() if value.strip()]
        for expected in ('名称', '状态', '应用', '版本', '创建时间'):
            assert expected in headers, headers
        assert '项目' not in headers, headers
        assert release_name([r for r in releases(ui.api) if release_name(r) == name][0]) == name

        # The project collection returns everything at once: a pager would be a dead control.
        note = ui.page.locator('[data-ai-id="installed-apps:source-note"]').last
        expect(note).to_be_visible(timeout=30_000)
        assert surface.locator('[data-ai-id*="page-"]').count() == 0, 'project scope must not render a pager'
        screenshot(ui.page, 'project-apps-list')
    finally:
        if created:
            remove_release(ui.api, name)
