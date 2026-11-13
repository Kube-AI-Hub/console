from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_WORKBENCH_ENTRY_01(workbench_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01 工作台：企业空间 → 项目入口，且顶部「工作台」可用。"""

    ui = workbench_page

    # The header's 工作台 entry points at `/kube-frontend/`. It used to point at a path with
    # no route and landed on Not Found, which is why this case starts by using that entry.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    expect(ui.page.locator('[data-ai-id="clusters:surface"]').last).to_be_visible(timeout=30_000)
    # 工作台 is a link (the platform entry is the only dropdown).
    ui.page.locator('[data-ai-id="global-nav:workbench"]').first.click()
    expect(ui.page.locator('[data-ai-id="workbench:surface"]')).to_be_visible(timeout=30_000)
    assert ui.page.url.rstrip("/").endswith("/kube-frontend"), ui.page.url

    ui.wait_ready()

    # The section list is per cluster and its projects load after the page's own state
    # settles, so wait for a row rather than sampling immediately: an immediate sample
    # reads "no workspaces" while the projects are still arriving.
    sections_locator = ui.page.locator('[data-ai-id^="workbench:workspace:"]')
    try:
        expect(sections_locator.first).to_be_visible(timeout=60_000)
    except AssertionError:
        # A platform with no enterprise space is a legitimate state; say so rather than
        # pretending the page is fine.
        expect(ui.page.locator('[data-ai-id="workbench:empty"]')).to_be_visible(timeout=10_000)
        pytest.skip("平台没有可进入的项目，工作台显示空态")

    sections = ui.workspace_sections()
    projects = ui.project_links()
    assert projects, f"企业空间存在但没有列出项目: {sections}"

    # Every entry is `workbench:project:<cluster>/<project>`: the project's cluster is part
    # of the identity, because the same name can exist on two clusters.
    cluster, project = projects[0].split(":", 2)[-1].split("/", 1)
    ui.open_project(cluster, project)
    expect(ui.page.locator('[data-ai-id="configmaps:surface"]')).to_be_visible(timeout=30_000)
    assert f"/clusters/{cluster}/projects/{project}/" in ui.page.url, ui.page.url
    screenshot(ui.page, "workbench-entry")
