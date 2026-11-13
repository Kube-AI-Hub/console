from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_PROJECT_SETTINGS_01(project_settings_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01 项目设置：角色与成员切换不产生文档请求。"""

    ui = project_settings_page
    ui.open("roles")
    ui.wait_ready("roles")
    assert ui.active_tab() == "area-tabs:roles"

    # Let the first navigation settle, or a document request already in flight is
    # charged to the tab switch this case is measuring.
    ui.page.wait_for_load_state("networkidle")
    ui.page.wait_for_timeout(300)

    documents: list[str] = []
    ui.page.on("request", lambda r: documents.append(r.url) if r.resource_type == "document" else None)

    ui.page.locator('[data-ai-id="area-tabs:members"]').click()
    expect(ui.surface("members")).to_be_visible()
    ui.wait_ready("members")
    assert ui.active_tab() == "area-tabs:members"

    ui.page.locator('[data-ai-id="area-tabs:roles"]').click()
    expect(ui.surface("roles")).to_be_visible()
    ui.wait_ready("roles")
    assert ui.active_tab() == "area-tabs:roles"

    assert documents == [], f"tab switching reloaded the document: {documents}"
    assert "default" in ui.page.locator('[data-ai-id="workspace:current-project"]').inner_text()
    screenshot(ui.page, "project-settings-tabs")
