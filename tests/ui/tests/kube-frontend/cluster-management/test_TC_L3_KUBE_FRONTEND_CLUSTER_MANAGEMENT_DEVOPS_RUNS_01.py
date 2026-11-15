from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

RUNS_GLOB = "**/pipelineruns*"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_RUNS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01 运行请求链路、运行记录、运行详情与日志错误。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)
    container = devops.pick_container()
    if container is None:
        pytest.skip("集群没有命名空间可用的 DevOps 工程：运行链路需要真实工程命名空间")
    project, namespace = container

    suffix = devops.unique("pwspec-run")[-8:]
    pipeline = f"pwspec-run-{suffix}"
    created_runs: list[str] = []

    try:
        devops.create_pipeline(project, pipeline, jenkinsfile="pipeline { agent any }")
        before = {str((item.get("metadata") or {}).get("name")) for item in devops.runs(namespace, pipeline)}
        assert before == set()

        devops.open_pipeline(project, pipeline)
        devops.click("pipeline-detail:run")
        expect(devops.surface("pipeline-detail:run-form")).to_be_visible(timeout=20_000)
        devops.click("pipeline-detail:run-submit")
        expect(devops.surface("pipeline-detail:notice")).to_contain_text("已提交运行请求", timeout=60_000)

        # ---- the request chain really created a PipelineRun with the pipeline identity ----
        runs = devops.runs(namespace, pipeline)
        assert len(runs) == 1, [str((item.get("metadata") or {}).get("name")) for item in runs]
        run = runs[0]
        run_name = str((run.get("metadata") or {}).get("name"))
        created_runs.append(run_name)
        labels = (run.get("metadata") or {}).get("labels") or {}
        generate_name = str((run.get("metadata") or {}).get("generateName") or "")
        assert labels.get("devops.kubesphere.io/pipeline") == pipeline, labels
        assert (run.get("spec") or {}).get("pipelineRef", {}).get("name") == pipeline
        assert generate_name.startswith(pipeline + "-")
        expect(devops.surface("pipeline-detail:notice")).to_contain_text(run_name)

        # ---- run history: the un-annotated run is shown as 未运行, never as success ----
        expect(ui.page.locator(f'[data-ai-id="pipeline-detail:runs-table"] tbody tr[data-ai-row="{run_name}"]')).to_be_visible(timeout=60_000)
        expect(ui.page.locator(f'[data-ai-id="pipeline-detail:run-status:{run_name}"]')).to_have_text("未运行")
        expect(ui.page.locator(f'[data-ai-id="pipeline-detail:run-link:{run_name}"]')).to_have_text(run_name)
        run_detail_link = ui.page.locator(f'[data-ai-id="pipeline-detail:run-link:{run_name}"]')
        expect(run_detail_link).to_have_attribute("href", f"/kube-frontend/clusters/{ui.cluster}/devops/{project}/pipelines/{pipeline}?run={run_name}")

        # ---- run detail: object fields plus the 404 log error with retry ----
        run_detail_link.click()
        expect(devops.surface("pipeline-detail:run-detail")).to_be_visible(timeout=30_000)
        expect(devops.surface("pipeline-detail:run-id")).to_have_text(run_name)
        expect(devops.surface("pipeline-detail:run-status")).to_have_text("未运行")
        expect(devops.surface("pipeline-detail:run-duration")).to_have_text("-")
        expect(devops.surface("pipeline-detail:run-log-error")).to_be_visible(timeout=60_000)
        expect(devops.surface("pipeline-detail:run-log-retry")).to_be_visible()
        assert ui.page.locator('[data-ai-id="pipeline-detail:run-log"]').count() == 0
        devops.click("pipeline-detail:run-log-retry")
        expect(devops.surface("pipeline-detail:run-log-error")).to_be_visible(timeout=60_000)

        # ---- replay creates a second run object with the same pipeline identity ----
        devops.click(f"pipeline-detail:run-replay:{run_name}")
        expect(devops.surface("pipeline-detail:notice")).to_contain_text("已提交运行请求", timeout=60_000)
        expect(ui.page.locator('[data-ai-id^="pipeline-detail:run-link:"]')).to_have_count(2, timeout=60_000)
        runs = devops.runs(namespace, pipeline)
        assert len(runs) == 2
        for item in runs:
            name = str((item.get("metadata") or {}).get("name"))
            if name not in created_runs:
                created_runs.append(name)

        # ---- a rejected request surfaces the server message, not a fake success ----
        def fail_create(route):
            if route.request.method == "POST":
                route.fulfill(
                    status=422,
                    content_type="application/json",
                    body='{"code":"invalid","message":"intercepted run failure"}',
                )
            else:
                route.continue_()

        ui.page.route(RUNS_GLOB, fail_create)
        try:
            devops.click(f"pipeline-detail:run-replay:{run_name}")
            expect(devops.surface("pipeline-detail:notice")).to_contain_text("intercepted run failure", timeout=60_000)
            assert len(devops.runs(namespace, pipeline)) == 2, "失败的请求不应创建运行对象"
        finally:
            ui.page.unroute(RUNS_GLOB)

        screenshot(ui.page, "devops-pipeline-runs")
    finally:
        for name in created_runs:
            devops.delete_run_quiet(namespace, name)
        devops.delete_pipeline_quiet(project, pipeline)
