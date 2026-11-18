from __future__ import annotations

import pytest
from playwright.sync_api import expect

from helpers.cronjobs import create_cronjob, delete_cronjob, job_name, wait_job

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_08(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-08 定时任务详情：运行记录默认页签与任务行。"""

    ui = app_workloads_page
    assert ui.api is not None

    name = ui.unique("cron")
    labels = {"tc-e2e-cronjob": name}
    create_cronjob(ui, name, labels, suspend=False)
    idle = ui.unique("cron-idle")
    create_cronjob(ui, idle, {"tc-e2e-cronjob": idle}, suspend=True)
    try:
        job = wait_job(ui, labels)
        created_job = job_name(job)

        origin = ui.base.split("/kube-frontend/")[0]
        ui.page.goto(f"{origin}/kube-frontend/system-workspace/clusters/host/projects/default/cronjobs/{name}")
        surface = ui.page.locator('[data-ai-id="cronjobs-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)

        # The page opens on 运行记录 — the question it exists to answer.
        trigger = ui.page.locator('[data-ai-id="workload-detail:tab-trigger:runs"]')
        expect(trigger).to_have_attribute("aria-selected", "true", timeout=30_000)
        expect(ui.page.locator('[data-ai-id="workload-detail:tab:runs"]')).to_be_visible()

        table = ui.page.locator('[data-ai-id="cronjobs-detail:runs-table"]')
        expect(table).to_be_visible(timeout=60_000)
        row = ui.page.locator(f'[data-ai-row="{created_job}"]')
        expect(row).to_be_visible(timeout=60_000)
        # The result column says which of the three outcomes this run has.
        assert any(label in row.inner_text() for label in ("已完成", "失败", "运行中")), row.inner_text()
        link = ui.page.locator(f'[data-ai-id="cronjobs-detail:run:{created_job}"]')
        href = link.get_attribute("href") or ""
        assert href.endswith(f"/jobs/{created_job}"), f"任务名应链接到该任务的详情：{href}"
        screenshot(ui.page, "cronjob-runs")

        # A CronJob that has not fired yet explains itself instead of showing an empty table.
        ui.page.goto(f"{origin}/kube-frontend/system-workspace/clusters/host/projects/default/cronjobs/{idle}")
        expect(ui.page.locator('[data-ai-id="cronjobs-detail:runs-empty"]')).to_be_visible(timeout=60_000)
        assert "还没有运行记录" in ui.page.locator('[data-ai-id="cronjobs-detail:runs-empty"]').inner_text()
        assert ui.page.locator('[data-ai-id="cronjobs-detail:runs-table"]').count() == 0
    finally:
        delete_cronjob(ui, name, labels)
        delete_cronjob(ui, idle, {"tc-e2e-cronjob": idle})