from __future__ import annotations

import re
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEVOPS_PROJECTS = "/apis/devops.kubesphere.io/v1alpha3/devopsprojects"
PIPELINES = "/apis/devops.kubesphere.io/v1alpha3/namespaces/{ns}/pipelines"
PIPELINE_RUNS_PATTERN = re.compile(r"/apis/devops\.kubesphere\.io/v1alpha3/namespaces/[^/]+/pipelineruns")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-03 流水线详情：基本信息与运行记录。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", DEVOPS_PROJECTS)
    assert status == 200, (status, body)
    projects = (body or {}).get("items") or []
    if projects:
        project = projects[0] or {}
        devops = (project.get("metadata") or {}).get("name") or ""
        namespace = ((project.get("status") or {}).get("adminNamespace") or devops).strip()
    else:
        devops = f"tc-e2e-missing-devops-{uuid4().hex[:8]}"
        namespace = devops
    assert devops

    status, body = ui.api.request("GET", PIPELINES.format(ns=namespace))
    pipelines = (body or {}).get("items") or [] if status == 200 else []
    pipeline = ((pipelines[0].get("metadata") or {}).get("name")) if pipelines else f"tc-e2e-missing-pipeline-{uuid4().hex[:8]}"
    assert pipeline

    def fail_runs(route):
        # Non-retryable status keeps the intercepted message visible; a 5xx would be
        # collapsed into the generic 网络异常 copy and the test could not name the failure.
        route.fulfill(
            status=422,
            content_type="application/json",
            body='{"code":"invalid","message":"intercepted runs failure"}',
        )

    ui.page.route(PIPELINE_RUNS_PATTERN, fail_runs)
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/devops/{devops}/pipelines/{pipeline}")
        surface = ui.page.locator('[data-ai-id="pipeline-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        if pipelines:
            basic = ui.page.locator('[data-ai-id="pipeline-detail:basic"]').last
            expect(basic).to_be_visible(timeout=60_000)
            for handle in ("name", "type", "status", "created-at", "namespace"):
                expect(ui.page.locator(f'[data-ai-id="pipeline-detail:{handle}"]').last).to_be_visible(timeout=30_000)
        else:
            expect(ui.page.locator('[data-ai-id="pipeline-detail:not-found"]').last).to_be_visible(timeout=60_000)

        # ---- run history: failure + retry recovery ----
        runs = ui.page.locator('[data-ai-id="pipeline-detail:runs"]').last
        expect(runs).to_be_visible(timeout=30_000)
        expect(ui.page.locator('[data-ai-id="pipeline-detail:runs-error"]').last).to_be_visible(timeout=60_000)
        expect(ui.page.locator('[data-ai-id="pipeline-detail:runs-error"]').last).to_contain_text("intercepted runs failure")

        ui.page.unroute(PIPELINE_RUNS_PATTERN)
        ui.page.locator('[data-ai-id="pipeline-detail:runs-retry"]').last.click()
        expect(ui.page.locator('[data-ai-id="pipeline-detail:runs-error"]')).to_have_count(0, timeout=60_000)

        table = ui.page.locator('[data-ai-id="pipeline-detail:runs-table"]')
        empty = ui.page.locator('[data-ai-id="pipeline-detail:runs-empty"]')
        collected = ui.page.locator(
            '[data-ai-id="pipeline-detail:runs-table"], [data-ai-id="pipeline-detail:runs-empty"]'
        )
        expect(collected.first).to_be_visible(timeout=60_000)
        if empty.count() > 0:
            expect(empty.last).to_contain_text("该流水线还没有运行记录")
        else:
            headers = [title.strip() for title in table.locator("thead th").all_inner_texts()]
            for column in ("编号", "状态", "开始时间", "耗时"):
                assert column in headers, headers

        # The detail page is read-only: no run/replay/stop entry point exists.
        assert ui.page.locator('[data-ai-id="pipeline-detail:run"]').count() == 0

        # ---- the project detail's pipeline row links here (only with real data) ----
        if pipelines:
            ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/devops/{devops}")
            tab = ui.page.locator('[data-ai-id="devops-detail:tab:pipelines"]').last
            expect(tab).to_be_visible(timeout=30_000)
            tab.click()
            link = ui.page.locator(f'[data-ai-id="devops-detail:pipeline:{pipeline}"]').last
            expect(link).to_be_visible(timeout=60_000)
            expect(link).to_have_attribute("href", f"/kube-frontend/clusters/{ui.cluster}/devops/{devops}/pipelines/{pipeline}")

        screenshot(ui.page, "pipeline-detail")
    finally:
        ui.page.unroute(PIPELINE_RUNS_PATTERN)
