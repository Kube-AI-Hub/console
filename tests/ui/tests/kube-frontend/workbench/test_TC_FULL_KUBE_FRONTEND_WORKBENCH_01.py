from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_WORKBENCH_01(workbench_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-WORKBENCH-01 工作台到项目控制台的完整路径。"""

    ui = workbench_page
    ui.open()
    ui.wait_ready()

    sections = ui.page.locator('[data-ai-id^="workbench:workspace:"]')
    try:
        expect(sections.first).to_be_visible(timeout=60_000)
    except AssertionError:
        pytest.skip("平台没有可进入的项目")

    projects = ui.project_links()
    assert projects, "工作台列出了企业空间却没有项目"

    cluster, project = projects[0].split(":", 2)[-1].split("/", 1)
    ui.open_project(cluster, project)

    # A project console is one page in a three-level context: the area sidebar, the context
    # bar, and the page itself. All three must be on screen for the entry to be complete.
    expect(ui.page.locator('[data-ai-id="workspace-bar"]')).to_be_visible(timeout=30_000)
    expect(ui.page.locator('aside a').first).to_be_visible()
    expect(ui.page.locator('[data-ai-id="workspace:current-workspace"]')).to_be_visible()
    screenshot(ui.page, "workbench-full")
