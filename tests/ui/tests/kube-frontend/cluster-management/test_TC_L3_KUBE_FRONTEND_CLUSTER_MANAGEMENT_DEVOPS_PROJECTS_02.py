from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

PIPELINES_LIST_GLOB = "**/kapis/devops.kubesphere.io/v1alpha3/devops/*/pipelines*"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02 DevOps 详情流水线/CD/代码仓库页签。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)

    projects = devops.projects()
    if not projects:
        pytest.skip("集群没有可用的 DevOps 工程：三个集合页签需要真实工程才能验证命名空间与三态")
    project = projects[0]
    name = str((project.get("metadata") or {}).get("name") or "")
    expected_namespace = devops.namespace_of(project)
    assert name and expected_namespace

    # The failure state is constructed by intercepting only the pipelines read: the tab must
    # say why it failed and offer a retry, without taking down the other reads.
    def fail_pipelines(route):
        # A non-retryable status so the panel shows the message itself; a 5xx is rendered as
        # the generic network copy, which would hide which read failed.
        route.fulfill(
            status=422,
            content_type="application/json",
            body='{"code":"invalid","message":"intercepted pipelines failure"}',
        )

    ui.page.route(PIPELINES_LIST_GLOB, fail_pipelines)
    try:
        devops.open_project(name)
        expect(devops.surface("devops-detail:namespace")).to_have_text(expected_namespace, timeout=30_000)

        # ---- pipelines: failure + retry recovers to the real list ----
        devops.open_tab("pipelines")
        expect(devops.surface("devops-detail:pipelines")).to_be_visible(timeout=20_000)
        expect(devops.surface("devops-detail:pipelines-error")).to_be_visible(timeout=60_000)
        expect(devops.surface("devops-detail:pipelines-error")).to_contain_text("intercepted pipelines failure")

        ui.page.unroute(PIPELINES_LIST_GLOB)
        devops.click("devops-detail:pipelines-retry")
        expect(ui.page.locator('[data-ai-id="devops-detail:pipelines-error"]')).to_have_count(0, timeout=60_000)
        expect(
            ui.page.locator(
                '[data-ai-id="devops-detail:pipelines-table"], [data-ai-id="devops-detail:pipelines-empty"]'
            ).first
        ).to_be_visible(timeout=60_000)

        # ---- CD and code repositories: independent reads, one state each ----
        for key in ("cd", "code-repo"):
            devops.open_tab(key)
            expect(devops.surface(f"devops-detail:{key}-panel")).to_be_visible(timeout=20_000)
            devops.expect_exactly_one_state(key)

        screenshot(ui.page, "devops-project-pipelines")
    finally:
        ui.page.unroute(PIPELINES_LIST_GLOB)
