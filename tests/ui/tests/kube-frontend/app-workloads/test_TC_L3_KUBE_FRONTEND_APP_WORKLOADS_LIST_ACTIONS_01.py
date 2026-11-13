from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEPLOYMENTS = "/apis/apps/v1/namespaces/default/deployments"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_ACTIONS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_ACTIONS-01 工作负载列表：扩缩容与重新部署。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("rowact")
    ui.create_deployment(name, replicas=1, image="nginx:1.27")
    try:
        ui.open("deployments")
        ui.ensure_row("deployments", name)

        actions = ui.row_actions("deployments", name)
        # Both live in the list menu on the old console; a scale-out is usually decided
        # while scanning the list rather than after opening one workload.
        assert "扩缩容" in actions, actions
        assert "重新部署" in actions, actions

        ui.run_row_action("deployments", name, "扩缩容")
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        ui.page.locator("#ai-field-replicas").fill("3")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, body = ui._request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200
        assert (body.get("spec") or {}).get("replicas") == 3, body.get("spec")

        ui.ensure_row("deployments", name)
        ui.run_row_action("deployments", name, "重新部署")
        ui.page.locator('[data-ai-id="deployments:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="deployments:delete-confirm"]').click()
        ui.page.wait_for_timeout(4000)

        status, body = ui._request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200
        annotations = ((body.get("spec") or {}).get("template") or {}).get("metadata", {}).get("annotations") or {}
        # A redeploy is the annotation the controller watches; without it nothing rolls.
        assert annotations.get("kubectl.kubernetes.io/restartedAt"), annotations
        screenshot(ui.page, "workload-row-actions")
    finally:
        ui.delete_deployment(name)
