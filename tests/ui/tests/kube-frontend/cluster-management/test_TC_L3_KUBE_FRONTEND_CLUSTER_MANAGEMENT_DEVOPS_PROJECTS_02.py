from __future__ import annotations

import re
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEVOPS_PROJECTS = "/apis/devops.kubesphere.io/v1alpha3/devopsprojects"
PIPELINES_PATTERN = re.compile(r"/apis/devops\.kubesphere\.io/v1alpha3/namespaces/[^/]+/pipelines$")
TABS = ("pipelines", "cd", "coderepos")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-02 DevOps 详情流水线/CD/代码仓库页签。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", DEVOPS_PROJECTS)
    assert status == 200, (status, body)
    items = (body or {}).get("items") or []
    if items:
        project = items[0] or {}
        name = (project.get("metadata") or {}).get("name") or ""
        # The project's namespace is its status.adminNamespace, not its name; fall back
        # the same way the page does so an object without the field still checks out.
        expected_namespace = ((project.get("status") or {}).get("adminNamespace") or name).strip()
    else:
        name = f"tc-e2e-missing-devops-{uuid4().hex[:8]}"
        expected_namespace = name
    assert name

    # The failure state is constructed by intercepting only the pipelines read: the tab
    # must say why it failed and offer a retry, without taking down the other reads.
    def fail_pipelines(route):
        # A non-retryable status so the panel shows the message itself; a 5xx is
        # rendered as the generic 网络异常 copy, which would hide which read failed.
        route.fulfill(
            status=422,
            content_type="application/json",
            body='{"code":"invalid","message":"intercepted pipelines failure"}',
        )

    ui.page.route(PIPELINES_PATTERN, fail_pipelines)
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/devops/{name}")
        detail = ui.page.locator('[data-ai-id="devops-detail:surface"]').last
        expect(detail).to_be_visible(timeout=30_000)
        expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        if items:
            expect(ui.page.locator('[data-ai-id="devops-detail:namespace"]').last).to_have_text(expected_namespace, timeout=30_000)
        else:
            expect(ui.page.locator('[data-ai-id="devops-detail:not-found"]').last).to_be_visible(timeout=60_000)

        # ---- pipelines: failure + retry recovers to the real (empty) list ----
        tab = ui.page.locator('[data-ai-id="devops-detail:tab:pipelines"]').last
        expect(tab).to_be_visible(timeout=30_000)
        tab.click()
        expect(tab).to_have_attribute("aria-selected", "true")
        expect(ui.page.locator('[data-ai-id="devops-detail:pipelines"]').last).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="devops-detail:pipelines-error"]').last).to_be_visible(timeout=60_000)
        expect(ui.page.locator('[data-ai-id="devops-detail:pipelines-error"]').last).to_contain_text("intercepted pipelines failure")

        ui.page.unroute(PIPELINES_PATTERN)
        ui.page.locator('[data-ai-id="devops-detail:pipelines-retry"]').last.click()
        expect(ui.page.locator('[data-ai-id="devops-detail:pipelines-error"]')).to_have_count(0, timeout=60_000)
        collected = ui.page.locator(
            '[data-ai-id="devops-detail:pipelines-empty"], [data-ai-id="devops-detail:pipelines-table"]'
        )
        expect(collected.first).to_be_visible(timeout=60_000)

        # ---- CD and code repositories: independent reads, one state each ----
        for key in ("cd", "coderepos"):
            trigger = ui.page.locator(f'[data-ai-id="devops-detail:tab:{key}"]').last
            expect(trigger).to_be_visible(timeout=30_000)
            trigger.click()
            expect(trigger).to_have_attribute("aria-selected", "true")
            expect(ui.page.locator(f'[data-ai-id="devops-detail:{key}"]').last).to_be_visible(timeout=20_000)
            handles = [
                ui.page.locator(f'[data-ai-id="devops-detail:{key}-table"]'),
                ui.page.locator(f'[data-ai-id="devops-detail:{key}-empty"]'),
                ui.page.locator(f'[data-ai-id="devops-detail:{key}-error"]'),
            ]
            collected = ui.page.locator(
                f'[data-ai-id="devops-detail:{key}-table"], [data-ai-id="devops-detail:{key}-empty"], '
                f'[data-ai-id="devops-detail:{key}-error"]'
            )
            expect(collected.first).to_be_visible(timeout=60_000)
            visible = sum(1 for handle in handles if handle.count() > 0)
            assert visible == 1, f"{key} panel should render exactly one of table/empty/error, got {visible}"

        screenshot(ui.page, "devops-project-pipelines")
    finally:
        ui.page.unroute(PIPELINES_PATTERN)
