from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

from helpers.cronjobs import create_cronjob, delete_cronjob, job_name, jobs_of

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_09(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-09 定时任务详情：立即运行一次创建任务。"""

    ui = app_workloads_page
    assert ui.api is not None

    name = ui.unique("cron-manual")
    labels = {"tc-e2e-cronjob": name}
    create_cronjob(ui, name, labels, suspend=True)
    try:
        origin = ui.base.split("/kube-frontend/")[0]
        ui.page.goto(f"{origin}/kube-frontend/system-workspace/clusters/host/projects/default/cronjobs/{name}")
        expect(ui.page.locator('[data-ai-id="cronjobs-detail:surface"]').last).to_be_visible(timeout=30_000)
        # A suspended CronJob starts with no runs at all. Which of the three states renders is
        # asserted instead of only waiting for the empty one: a timeout on one selector cannot
        # tell "still loading" from "read failed", and both are different defects.
        deadline = time.time() + 90
        state = ""
        while time.time() < deadline:
            for candidate in ("runs-empty", "runs-table", "runs-error"):
                if ui.page.locator(f'[data-ai-id="cronjobs-detail:{candidate}"]').count() > 0:
                    state = candidate
                    break
            if state:
                break
            ui.page.wait_for_timeout(1000)
        assert state, f"运行记录既没有空态也没有表格或错误态：{ui.page.inner_text('body')[:300]}"
        assert state != "runs-error", f"运行记录读取失败：{ui.page.inner_text('body')[:300]}"

        button = ui.page.locator('[data-ai-id="cronjobs-detail:run-now"]')
        expect(button).to_be_enabled(timeout=30_000)
        button.click()

        deadline = time.time() + 90
        created: list[dict] = []
        while time.time() < deadline:
            created = [
                job
                for job in jobs_of(ui, labels)
                if (job.get("metadata") or {}).get("annotations", {}).get("cronjob.kubernetes.io/instantiate") == "manual"
            ]
            if created:
                break
            time.sleep(2)
        assert created, "点了「立即运行一次」但没有创建出任务"
        created_job = job_name(created[0])

        # The template labels travel with the Job, which is what makes it show up in the history.
        assert (created[0].get("metadata") or {}).get("labels") == labels, created[0].get("metadata")

        row = ui.page.locator(f'[data-ai-row="{created_job}"]')
        expect(row).to_be_visible(timeout=60_000)
        assert ui.page.locator('[data-ai-id="cronjobs-detail:runs-empty"]').count() == 0
        screenshot(ui.page, "cronjob-run-now")
    finally:
        delete_cronjob(ui, name, labels)