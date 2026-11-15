from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

TABS = ("members", "roles", "credentials")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-01 DevOps 工程列表与详情骨架。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)

    projects = devops.projects()
    expected = len(projects)

    devops.open_list()
    surface = devops.surface("devops:surface")
    state = surface.get_attribute("data-ai-state")

    if expected == 0:
        assert state == "empty", f"expected empty state, got {state}"
        assert "暂无 DevOps 工程" in surface.inner_text()
        expect(surface.locator("tbody tr[data-ai-row]")).to_have_count(0)
        name = "tc-e2e-missing-devops"
    else:
        assert state == "ready", f"expected ready state, got {state}"
        expect(surface.locator("tbody tr[data-ai-row]")).to_have_count(expected, timeout=30_000)
        name = str((projects[0].get("metadata") or {}).get("name") or "")
        assert name
        expect(ui.page.locator(f'[data-ai-id="devops:link:{name}"]').last).to_be_visible(timeout=30_000)
        # The list now has a create entry; the read-only skeleton must keep it reachable.
        expect(ui.page.locator('[data-ai-id="devops:create"]').last).to_be_visible(timeout=30_000)

    # Detail: an existing project shows its base-info and the three attribute tabs; a missing
    # one shows not-found and does not render tabs (no collections are queried for it).
    devops.open_project(name)
    if expected == 0:
        expect(devops.surface("devops-detail:not-found")).to_be_visible(timeout=60_000)
    else:
        expect(devops.surface("devops-detail:basic")).to_be_visible(timeout=60_000)
        expect(devops.tab("base-info")).to_have_attribute("aria-selected", "true")
        for tab in TABS:
            devops.open_tab(tab)
            expect(devops.surface(f"devops-detail:{tab}-panel")).to_be_visible(timeout=20_000)
            # Exactly one of table / empty / failure may describe the collection; a failure
            # must not render as an empty table.
            devops.expect_exactly_one_state(tab)

    screenshot(ui.page, "devops-projects")
