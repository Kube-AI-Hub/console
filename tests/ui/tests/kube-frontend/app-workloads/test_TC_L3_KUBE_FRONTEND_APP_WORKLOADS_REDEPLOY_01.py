from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_REDEPLOY_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REDEPLOY-01 重新部署：加载对话框与 restartedAt。"""

    ui = app_workloads_page
    name = ui.unique("redeploy")
    try:
        ui.create_deployment(name, replicas=1)
        ui.open_detail("deployments", name)
        expect(ui.redeploy_button).to_be_visible()

        # Hold the PATCH in the browser (not in a Playwright route handler, which
        # would block this thread too) so the loading frame is observable instead
        # of racing a local request that finishes in tens of milliseconds.
        ui.page.evaluate(
            """() => {
                const original = globalThis.fetch;
                globalThis.fetch = (input, init = {}) => {
                    const method = String(init.method || 'GET').toUpperCase();
                    const url = typeof input === 'string' ? input : input.url;
                    if (method === 'PATCH' && url.includes('/apis/apps/v1/namespaces/default/deployments/')) {
                        return new Promise((resolve) => setTimeout(resolve, 1500)).then(() => original(input, init));
                    }
                    return original(input, init);
                };
            }"""
        )

        ui.redeploy_button.click()
        expect(ui.loading_dialog).to_be_visible(timeout=5_000)
        # The frame is titled 重新部署 and names the object in its body.
        assert "重新部署" in ui.dialog.inner_text(), ui.dialog.inner_text()
        assert name in ui.loading_dialog.inner_text(), ui.loading_dialog.inner_text()

        stamp = ui.wait_restart_annotation(name, timeout=30)
        assert stamp, "restartedAt must not be empty"
        ui.wait_dialog_closed()
        screenshot(ui.page, "redeploy")
    finally:
        ui.delete_deployment(name)
