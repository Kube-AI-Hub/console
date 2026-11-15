from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"
DEPLOYMENTS = f"/apis/apps/v1/namespaces/{NS}/deployments"


def _create_deployment(api, name: str) -> None:
    status, body = api.request(
        "POST",
        DEPLOYMENTS,
        {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {"name": name, "namespace": NS},
            "spec": {
                "replicas": 1,
                "selector": {"matchLabels": {"app": name}},
                "template": {
                    "metadata": {"labels": {"app": name}},
                    "spec": {"containers": [{"name": "app", "image": "nginx:1.27"}]},
                },
            },
        },
    )
    assert status in (200, 201), (status, body)
    deadline = time.time() + 60
    while time.time() < deadline:
        status, _ = api.request("GET", f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{NS}/deployments/{name}")
        if status == 200:
            return
        time.sleep(2)
    raise AssertionError("deployment did not become readable")


def _pod_spec(body: dict) -> dict:
    return (((body.get("spec") or {}).get("template") or {}).get("spec") or {})


def _open(ui, origin: str, name: str):
    ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/deployments/{name}")
    surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
    expect(surface).to_be_visible(timeout=60_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
    expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
    expect(ui.page.locator('[data-ai-id="deployments-edit:volumes"]')).to_be_visible(timeout=20_000)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_SETTINGS_07(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-07 编辑设置：存储挂载。"""

    ui = app_workloads_page
    assert ui.api is not None
    origin = ui.base.split("/kube-frontend/")[0]
    name = f"tc-e2e-vol-{uuid.uuid4().hex[:8]}"

    try:
        _create_deployment(ui.api, name)
        _open(ui, origin, name)

        # A temporary volume needs no source; its mount needs an absolute path.
        ui.page.locator('[data-ai-id="deployments-edit:volume-add"]').click()
        volume_row = ui.page.locator('[data-ai-id="deployments-edit:volumes"] [data-ai-row^="volume-"]').last
        expect(volume_row).to_be_visible(timeout=10_000)
        volume_id = (volume_row.get_attribute("data-ai-row") or "").split("-")[-1]
        ui.page.locator(f'[data-ai-id="deployments-edit:volume-name:{volume_id}"]').fill("data")

        ui.page.locator('[data-ai-id="deployments-edit:mount-add"]').click()
        mount_row = ui.page.locator('[data-ai-id="deployments-edit:mounts"] [data-ai-row^="mount-"]').last
        expect(mount_row).to_be_visible(timeout=10_000)
        mount_id = (mount_row.get_attribute("data-ai-row") or "").split("-")[-1]
        # A relative path is refused locally.
        ui.page.locator(f'[data-ai-id="deployments-edit:mount-path:{mount_id}"]').fill("data")
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_disabled(timeout=10_000)
        ui.page.locator(f'[data-ai-id="deployments-edit:mount-path:{mount_id}"]').fill("/data")
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_enabled(timeout=10_000)
        screenshot(ui.page, "workload-edit-volumes")
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)

        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200, (status, body)
        pod = _pod_spec(body)
        assert pod.get("volumes") == [{"name": "data", "emptyDir": {}}], pod.get("volumes")
        container = (pod.get("containers") or [{}])[0]
        assert container.get("volumeMounts") == [{"name": "data", "mountPath": "/data"}], container.get("volumeMounts")

        # Switching the source to a claim rewrites the volume, and deleting it removes both sides.
        ui.page.reload(wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="deployments-detail:surface"]').last).not_to_have_attribute(
            "data-ai-state", "loading", timeout=60_000
        )
        _open(ui, origin, name)
        volume_row = ui.page.locator('[data-ai-id="deployments-edit:volumes"] [data-ai-row^="volume-"]').last
        volume_id = (volume_row.get_attribute("data-ai-row") or "").split("-")[-1]
        ui.page.locator(f'[data-ai-id="deployments-edit:volume-type:{volume_id}"]').click()
        ui.page.get_by_role("option", name="持久卷声明", exact=True).click()
        # The claim name is required for this type: an empty source must block the save.
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_disabled(timeout=10_000)
        ui.page.locator(f'[data-ai-id="deployments-edit:volume-source:{volume_id}"]').fill("shared-claim")
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_enabled(timeout=10_000)
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        pod = _pod_spec(body)
        assert pod.get("volumes") == [{"name": "data", "persistentVolumeClaim": {"claimName": "shared-claim"}}], pod.get("volumes")
    finally:
        ui.api.request("DELETE", f"{DEPLOYMENTS}/{name}")
