from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

from project_apps_helpers import PROJECT, WS, create_release, release_name, releases, remove_release, unique_name

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_PROJECT_APPS_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-03 项目内应用：详情与卸载。"""

    ui = app_workloads_page
    assert ui.api is not None
    origin = ui.base.split('/kube-frontend/')[0]
    name = unique_name()
    try:
        create_release(ui.api, name)
        item = next(entry for entry in releases(ui.api) if release_name(entry) == name)
        release_id = str(((item.get('cluster') or {}).get('cluster_id')) or '')
        assert release_id, item

        ui.page.goto(f'{ui.base}/applications')
        surface = ui.page.locator('[data-ai-id="installed-apps:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

        row = surface.locator(f'tbody tr[data-ai-row="{release_id}"]')
        expect(row).to_have_count(1, timeout=60_000)
        ui.page.locator(f'[data-ai-id="installed-apps:name:{release_id}"]').click()

        detail = ui.page.locator('[data-ai-id="installed-app:surface"]').last
        expect(detail).to_be_visible(timeout=60_000)
        expect(detail).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)
        tab_texts = [value.strip() for value in ui.page.locator('[role="tab"]').all_inner_texts()]
        for expected in ('基本信息', '资源', '事件', '配置', 'YAML'):
            assert any(expected in text for text in tab_texts), tab_texts
        screenshot(ui.page, 'project-apps-detail')

        ui.page.go_back()
        expect(surface).to_be_visible(timeout=60_000)
        row = surface.locator(f'tbody tr[data-ai-row="{release_id}"]')
        expect(row).to_have_count(1, timeout=60_000)
        ui.page.locator('[data-ai-id="installed-apps:uninstall"]').last.click()
        ui.page.locator('[data-ai-id="installed-apps:uninstall:confirm"]').click()

        deadline = time.time() + 120
        while time.time() < deadline:
            if not [entry for entry in releases(ui.api) if release_name(entry) == name]:
                break
            time.sleep(2)
        assert not [entry for entry in releases(ui.api) if release_name(entry) == name], '卸载后项目集合仍返回该 release'
        screenshot(ui.page, 'project-apps-uninstalled')
    finally:
        remove_release(ui.api, name)
