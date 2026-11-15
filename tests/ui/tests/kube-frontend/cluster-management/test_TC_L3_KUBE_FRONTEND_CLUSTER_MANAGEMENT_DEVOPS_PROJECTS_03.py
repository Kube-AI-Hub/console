from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

RUNS_GLOB = "**/pipelineruns*"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03 流水线详情：基本信息与运行记录。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)

    projects = devops.projects()
    if not projects:
        pytest.skip("集群没有可用的 DevOps 工程：流水线详情需要真实工程命名空间")
    project = projects[0]
    devops_name = str((project.get("metadata") or {}).get("name") or "")
    namespace = devops.namespace_of(project)
    items, _ = devops.pipelines(devops_name, page=1, limit=10)
    if items:
        pipeline = str((items[0].get("metadata") or {}).get("name") or "")
    else:
        pipeline = "tc-e2e-missing-pipeline"
    assert pipeline

    def fail_runs(route):
        # Non-retryable status keeps the intercepted message visible; a 5xx would be
        # collapsed into the generic network copy and the test could not name the failure.
        route.fulfill(
            status=422,
            content_type="application/json",
            body='{"code":"invalid","message":"intercepted runs failure"}',
        )

    ui.page.route(RUNS_GLOB, fail_runs)
    try:
        devops.open_pipeline(devops_name, pipeline)

        if items:
            expect(devops.surface("pipeline-detail:basic")).to_be_visible(timeout=60_000)
            for handle in ("name", "type", "sync-status", "health", "validate", "created-at", "namespace"):
                expect(devops.surface(f"pipeline-detail:{handle}")).to_be_visible(timeout=30_000)
        else:
            expect(devops.surface("pipeline-detail:not-found")).to_be_visible(timeout=60_000)

        # ---- run history: failure + retry recovery (only when the detail rendered) ----
        if items:
            expect(devops.surface("pipeline-detail:runs")).to_be_visible(timeout=30_000)
            expect(devops.surface("pipeline-detail:runs-error")).to_be_visible(timeout=60_000)
            expect(devops.surface("pipeline-detail:runs-error")).to_contain_text("intercepted runs failure")

            ui.page.unroute(RUNS_GLOB)
            devops.click("pipeline-detail:runs-retry")
            expect(ui.page.locator('[data-ai-id="pipeline-detail:runs-error"]')).to_have_count(0, timeout=60_000)

            table = ui.page.locator('[data-ai-id="pipeline-detail:runs-table"]')
            empty = ui.page.locator('[data-ai-id="pipeline-detail:runs-empty"]')
            expect(
                ui.page.locator('[data-ai-id="pipeline-detail:runs-table"], [data-ai-id="pipeline-detail:runs-empty"]').first
            ).to_be_visible(timeout=60_000)
            if empty.count() > 0:
                expect(empty.last).to_contain_text("该流水线还没有运行记录")
            else:
                headers = [title.strip() for title in table.locator("thead th").all_inner_texts()]
                for column in ("状态", "编号", "提交", "耗时", "开始时间"):
                    assert column in headers, headers

            # The page offers run / replay but no stop entry point.
            assert ui.page.locator('[data-ai-id="pipeline-detail:run"]').count() == 1
            assert ui.page.locator('[data-ai-id*="stop"]').count() == 0

            # ---- the project detail's pipeline row links here ----
            devops.open_project(devops_name)
            devops.open_tab("pipelines")
            link = devops.surface(f"devops-detail:pipeline:{pipeline}")
            expect(link).to_be_visible(timeout=60_000)
            expect(link).to_have_attribute(
                "href", f"/kube-frontend/clusters/{ui.cluster}/devops/{devops_name}/pipelines/{pipeline}"
            )

        screenshot(ui.page, "pipeline-detail")
    finally:
        ui.page.unroute(RUNS_GLOB)
