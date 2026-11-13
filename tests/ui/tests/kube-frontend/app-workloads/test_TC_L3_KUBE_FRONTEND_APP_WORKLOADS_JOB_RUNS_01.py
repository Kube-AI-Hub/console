from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

JOBS = "/apis/batch/v1/namespaces/default/jobs"

# Already pulled onto the nodes (it runs in the platform itself); pulling from Docker Hub
# on this cluster takes minutes, which would make the case about the registry.
LOCAL_IMAGE = "dockerhub.kubekey.local/kube-ai-hub/knative-releases/knative.dev/serving/cmd/queue:v1.16.1"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_JOB_RUNS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_RUNS-01 任务详情：执行记录。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("runs")
    status, _ = ui._request(
        "POST",
        JOBS,
        {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {"name": name, "namespace": "default"},
            "spec": {
                # `Never` keeps the pod around after it finishes, which is what makes a
                # run history inspectable at all.
                "backoffLimit": 0,
                "template": {
                    "metadata": {"labels": {"app": name}},
                    "spec": {"restartPolicy": "Never", "containers": [{"name": "c", "image": LOCAL_IMAGE}]},
                },
            },
        },
    )
    assert status in (200, 201), status
    try:
        # Wait for the pod to actually finish, not for the Job to say it succeeded: a
        # Job can be counted complete while its pod is still terminating.
        pods = "/api/v1/namespaces/default/pods"
        for _ in range(60):
            status, body = ui._request("GET", f"{pods}?labelSelector=job-name%3D{name}")
            life = (body.get("items") or []) if status == 200 else []
            if life and all((item.get("status") or {}).get("phase") in ("Succeeded", "Failed") for item in life):
                break
            ui.page.wait_for_timeout(2000)

        ui.page.goto(f"{ui.base}/jobs/{name}")
        surface = ui.detail_surface("jobs")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        block = ui.page.locator('[data-ai-id="jobs-detail:runs"]')
        expect(block).to_be_visible(timeout=30_000)
        headers = [text.strip() for text in block.locator("th").all_inner_texts()]
        assert headers == ["序号", "容器组名称", "状态", "退出码", "开始时间", "结束时间"], headers

        rows = block.locator("tbody tr")
        expect(rows).to_have_count(1)
        cells = [cell.strip() for cell in rows.first.locator("td").all_inner_texts()]
        # Numbering starts at 1 so it lines up with what the old console shows.
        assert cells[0] == "1", cells
        # The run completed one way or the other; which way is this pod's business.
        assert cells[2], cells
        assert cells[3].isdigit(), cells
        screenshot(ui.page, "job-runs")
    finally:
        ui._request("DELETE", f"{JOBS}/{name}")
