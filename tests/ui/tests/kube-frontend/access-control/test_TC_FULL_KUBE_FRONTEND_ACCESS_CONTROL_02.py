from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_ACCESS_CONTROL_02(access_control_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02 访问控制：根路径进入用户表。"""

    ui = access_control_page
    ui.open_landing()
    ui.wait_ready("users")

    expect(ui.page).to_have_url(re.compile(r"/kube-frontend/access/users/?$"), timeout=30_000)
    expect(ui.surface("users")).to_be_visible()
    assert ui.active_tab() == "area-tabs:users"
    for kind in ("users", "clusterroles", "workspaces"):
        expect(ui.page.locator(f'[data-ai-id="area-tabs:{kind}"]')).to_be_visible()
    assert ui.workspace_bar_count == 0, "platform landing must not render the project workspace bar"
    screenshot(ui.page, "access-landing-users")
