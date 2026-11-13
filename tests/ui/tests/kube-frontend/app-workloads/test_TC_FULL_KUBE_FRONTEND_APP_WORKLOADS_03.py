from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_APP_WORKLOADS_03(app_workloads_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-03 应用负载：创建部署与名称校验。"""

    ui = app_workloads_page
    name = ui.unique("created")
    try:
        ui.open("deployments")
        ui.page.locator('[data-ai-id="deployments:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()

        # Rejected: Kubernetes names are lower-case, so the form must refuse this
        # before a request is made.
        ui.page.locator("#ai-field-name").fill("Bad_Name")
        ui.page.locator("#ai-field-image").fill("nginx:1.27")
        dialog.get_by_role("button", name="确认").click()
        # "小写字母" is the name field's static hint, present before submitting — asserting
        # on it proved nothing. What distinguishes a refusal is: the dialog stays open and
        # no such Deployment exists afterwards.
        expect(dialog).to_have_count(1, timeout=15_000)
        assert ui.get_deployment("Bad_Name")[0] != 200, "非法名称竟然创建了 Deployment"

        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-replicas").fill("2")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, body = ui.get_deployment(name)
        assert status == 200, status
        assert (body.get("spec") or {}).get("replicas") == 2
        container = ((((body.get("spec") or {}).get("template") or {}).get("spec") or {}).get("containers") or [{}])[0]
        assert container.get("image") == "nginx:1.27"
        screenshot(ui.page, "workloads-create")
    finally:
        ui.delete_deployment(name)
