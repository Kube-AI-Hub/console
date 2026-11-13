from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEPLOYMENTS = "/apis/apps/v1/namespaces/default/deployments"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_FORM_UX_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-FORM_UX-01 表单：校验聚焦与提交失败提示。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("dup")
    ui.create_deployment(name, replicas=1, image="nginx:1.27")
    try:
        ui.open("deployments")
        ui.page.locator('[data-ai-id="deployments:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()

        # Submitting an empty form must land the caret on the first offending field: a
        # message rendered below the fold reads as "nothing happened".
        dialog.get_by_role("button", name="确认").click()
        ui.page.wait_for_timeout(500)
        assert ui.page.evaluate("() => document.activeElement?.id") == "ai-field-name"

        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-image").fill("nginx:1.27")
        dialog.get_by_role("button", name="确认").click()

        # The server rejects a duplicate name; the dialog stays open and says why.
        error = ui.page.locator('[data-ai-id="form:submit-error"]')
        expect(error).to_be_visible(timeout=30_000)
        assert "already exists" in error.inner_text(), error.inner_text()
        assert ui.page.locator("#ai-field-name").input_value() == name
        screenshot(ui.page, "form-submit-error")
    finally:
        ui.delete_deployment(name)
