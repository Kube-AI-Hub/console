from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_ACCESS_CONTROL_01(access_control_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01 访问控制：三页签切换且无项目工作区栏。"""

    ui = access_control_page
    ui.open("users")
    ui.wait_ready("users")
    assert ui.active_tab() == "area-tabs:users"
    # Platform records belong to no project: a project switcher here would change nothing.
    assert ui.workspace_bar_count == 0, "platform pages must not render the project workspace bar"

    ui.page.wait_for_load_state("networkidle")
    ui.page.wait_for_timeout(300)

    documents: list[str] = []
    ui.page.on("request", lambda r: documents.append(r.url) if r.resource_type == "document" else None)

    for kind in ("clusterroles", "workspaces", "users"):
        ui.page.locator(f'[data-ai-id="area-tabs:{kind}"]').click()
        expect(ui.surface(kind)).to_be_visible()
        ui.wait_ready(kind)
        assert ui.active_tab() == f"area-tabs:{kind}"
        assert ui.workspace_bar_count == 0

    assert documents == [], f"tab switching reloaded the document: {documents}"
    screenshot(ui.page, "access-control-tabs")
