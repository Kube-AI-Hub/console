from __future__ import annotations

import pytest
import json
import uuid
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_JOB_CREATE_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01 创建任务和定时任务并回读。"""
    ui = app_workloads_page
    assert ui.api is not None
    name = f"tc-e2e-create-job-{uuid.uuid4().hex[:8]}"
    job = f"/apis/batch/v1/namespaces/{ui.namespace}/jobs/{name}"
    cronjob = f"/apis/batch/v1/namespaces/{ui.namespace}/cronjobs/{name}"
    manifest = {
        "apiVersion": "batch/v1", "kind": "CronJob",
        "metadata": {"name": name, "namespace": ui.namespace},
        "spec": {
            "schedule": "0 * * * *", "suspend": True, "concurrencyPolicy": "Forbid",
            "jobTemplate": {"spec": {"template": {"spec": {
                "restartPolicy": "Never", "containers": [{"name": "test", "image": "busybox:1.37"}],
                "nodeSelector": {"test-not-a-real-node": "true"},
            }}}},
        },
    }
    try:
        ui.open("jobs")
        ui.network_create_button("jobs").click()
        ui.network_create_field("name").fill(name)
        ui.network_create_field("image").fill("busybox:1.37")
        ui.network_create_field("parallelism").fill("0")
        ui.network_create_field("backoffLimit").fill("2")
        ui.network_create_submit().click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", job)
        assert status == 200, body
        assert body["spec"]["parallelism"] == 0
        assert body["spec"]["backoffLimit"] == 2
        assert body["spec"]["template"]["spec"]["containers"][0]["image"] == "busybox:1.37"
        ui.open("cronjobs")
        ui.network_create_button("cronjobs").click()
        ui.network_yaml_switch("cronjobs").click()
        editor = ui.network_yaml_editor()
        expect(editor).to_be_visible()
        editor.fill(json.dumps(manifest))
        ui.network_yaml_submit("cronjobs").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", cronjob)
        assert status == 200, body
        assert body["spec"]["suspend"] is True
        assert body["spec"]["schedule"] == "0 * * * *"
        assert body["spec"]["jobTemplate"]["spec"]["template"]["spec"]["nodeSelector"] == {"test-not-a-real-node": "true"}
        screenshot(ui.page, "job-create")
    finally:
        ui.api.request("DELETE", cronjob)
        ui.api.request("DELETE", job)
