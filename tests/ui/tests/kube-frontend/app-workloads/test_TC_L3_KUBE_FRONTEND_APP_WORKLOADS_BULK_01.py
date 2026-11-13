from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEPLOYMENTS = "/apis/apps/v1/namespaces/default/deployments"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_BULK_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-BULK-01 工作负载列表：批量停止与批量删除。"""

    ui = app_workloads_page
    assert ui.api is not None
    first = ui.unique("bulk1")
    second = ui.unique("bulk2")
    ui.create_deployment(first, replicas=1, image="nginx:1.27")
    ui.create_deployment(second, replicas=1, image="nginx:1.27")
    try:
        ui.open("deployments")
        # Search first, then tick both rows: selection survives a filter change but a
        # page reload would clear it.
        # Both names share the `ui.unique` prefix, so one search shows them together.
        ui.page.locator('[data-ai-id="deployments:search"]').last.fill(first.rsplit("-", 1)[0])
        ui.page.wait_for_timeout(900)
        ui.wait_ready(ui.surface("deployments"))
        for name in (first, second):
            box = ui.page.locator(f'[data-ai-row="{name}"] input[type=checkbox]')
            expect(box).to_be_visible(timeout=20_000)
            box.check()
        ui.page.wait_for_timeout(700)

        actions = [text.strip() for text in ui.page.locator('[data-ai-id*="bulk"]').all_inner_texts()]
        # A scalable workload offers both; the old console has 批量停止 on Deployments.
        assert "批量停止" in actions, actions
        assert "批量删除" in actions, actions

        ui.page.locator('[data-ai-id="deployments:bulk-stop"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        # A batch is confirmed by its count: typing every name exactly is friction
        # nobody satisfies, and the button used to stay disabled forever.
        ui.page.locator('[data-ai-id="deployments:delete-input"]').fill("2")
        ui.page.locator('[data-ai-id="deployments:delete-confirm"]').click()
        ui.page.wait_for_timeout(4000)

        for name in (first, second):
            status, body = ui._request("GET", f"{DEPLOYMENTS}/{name}")
            assert status == 200
            # Stopping is scaling to zero, not deleting: the objects stay.
            assert (body.get("spec") or {}).get("replicas") == 0, (name, body.get("spec"))

        # The kinds without replicas offer only deletion.
        ui.open("jobs")
        ui.wait_ready(ui.surface("jobs"))
        checkbox = ui.page.locator("table tbody input[type=checkbox]").first
        if checkbox.count():
            checkbox.check()
            ui.page.wait_for_timeout(700)
            job_actions = [text.strip() for text in ui.page.locator('[data-ai-id*="bulk"]').all_inner_texts()]
            assert "批量停止" not in job_actions, job_actions
            assert "批量删除" in job_actions, job_actions
        screenshot(ui.page, "workload-bulk-actions")
    finally:
        ui.delete_deployment(first)
        ui.delete_deployment(second)
