from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_APP_WORKLOADS_02(app_workloads_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-02 应用负载：停止与启动的状态化操作。"""

    ui = app_workloads_page
    name = ui.unique("scale")
    cron = ui.unique("cron")
    try:
        # Both helpers return the object name; a failed create raises inside them.
        assert ui.create_deployment(name, replicas=2) == name
        assert ui.create_cronjob(cron) in (200, 201)

        ui.open("deployments")
        ui.ensure_row("deployments", name)

        # A running controller offers 停止, never 启动. Asserted as a subsequence so that
        # adding an action (扩缩容/重新部署 were added later) does not fail a case that
        # is really about 停止 appearing and 启动 not appearing.
        actions = ui.row_actions("deployments", name)
        required = ["编辑信息", "编辑 YAML", "停止", "删除"]
        positions = [actions.index(label) for label in required if label in actions]
        assert len(positions) == len(required), f"missing actions: {set(required) - set(actions)}"
        assert positions == sorted(positions), actions
        assert "启动" not in actions, actions
        ui.run_row_action("deployments", name, "停止")
        ui.page.locator('[data-ai-id="deployments:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="deployments:delete-confirm"]').click()
        ui.wait_replicas(name, 0)

        # Once stopped, the same row offers the opposite action only.
        ui.open("deployments")
        ui.ensure_row("deployments", name)
        resumed = ui.row_actions("deployments", name)
        required = ["编辑信息", "编辑 YAML", "启动", "删除"]
        positions = [resumed.index(label) for label in required if label in resumed]
        assert len(positions) == len(required), f"missing actions: {set(required) - set(resumed)}"
        assert positions == sorted(positions), resumed
        assert "停止" not in resumed, resumed
        ui.run_row_action("deployments", name, "启动")
        ui.page.locator('[data-ai-id="deployments:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="deployments:delete-confirm"]').click()
        ui.wait_replicas(name, 1)

        # A CronJob is suspended with `spec.suspend`, not deleted.
        ui.open("cronjobs")
        ui.ensure_row("cronjobs", cron)
        ui.run_row_action("cronjobs", cron, "暂停/启动")
        assert ui.wait_suspended(cron) is True
        screenshot(ui.page, "workloads-start-stop")
    finally:
        ui.delete_deployment(name)
        ui.delete_cronjob(cron)
