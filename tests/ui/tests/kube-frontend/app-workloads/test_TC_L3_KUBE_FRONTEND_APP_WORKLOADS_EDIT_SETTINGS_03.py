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
    # The detail page reads the workload through kapis; wait until it can see it.
    deadline = time.time() + 60
    while time.time() < deadline:
        status, _ = api.request("GET", f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{NS}/deployments/{name}")
        if status == 200:
            return
        time.sleep(2)
    raise AssertionError("deployment did not become readable")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_SETTINGS_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-03 编辑设置：容器资源限额。"""

    ui = app_workloads_page
    assert ui.api is not None
    # `ui.base` is the project URL; the app origin is what a detail URL is built from.
    origin = ui.base.split("/kube-frontend/")[0]
    name = f"tc-e2e-res-{uuid.uuid4().hex[:8]}"

    try:
        _create_deployment(ui.api, name)
        ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/deployments/{name}")
        surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
        expect(surface).to_be_visible(timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:resources"]')).to_be_visible(timeout=20_000)

        # A request larger than its limit is refused locally: no request, clear message.
        ui.page.locator('[data-ai-id="deployments-edit:cpu-request"]').fill('2')
        ui.page.locator('[data-ai-id="deployments-edit:cpu-limit"]').fill('1')
        expect(ui.page.locator('[data-ai-id="deployments-edit:resources-error"]')).to_be_visible(timeout=10_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_disabled()

        ui.page.locator('[data-ai-id="deployments-edit:cpu-request"]').fill('100m')
        ui.page.locator('[data-ai-id="deployments-edit:cpu-limit"]').fill('1')
        ui.page.locator('[data-ai-id="deployments-edit:memory-request"]').fill('128Mi')
        ui.page.locator('[data-ai-id="deployments-edit:memory-limit"]').fill('256Mi')
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_enabled(timeout=10_000)
        screenshot(ui.page, "workload-edit-resources")
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)

        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200, (status, body)
        container = (((body.get("spec") or {}).get("template") or {}).get("spec") or {}).get("containers", [{}])[0]
        assert container.get("resources") == {
            "requests": {"cpu": "100m", "memory": "128Mi"},
            "limits": {"cpu": "1", "memory": "256Mi"},
        }, container.get("resources")

        # Clearing every field removes the block instead of leaving an empty object.
        #
        # Reload before the second edit: the dialog submits the whole object with the
        # resourceVersion it was seeded with, and a save that lands while the detail query is still
        # refetching answers 409 (the dialog then correctly stays open). Reloading makes this case
        # about clearing resources rather than about a race with its own previous write.
        ui.page.reload(wait_until="domcontentloaded")
        surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:cpu-request"]')).to_have_value("100m", timeout=30_000)
        for handle in ("cpu-request", "cpu-limit", "memory-request", "memory-limit"):
            ui.page.locator(f'[data-ai-id="deployments-edit:{handle}"]').fill("")
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200
        container = (((body.get("spec") or {}).get("template") or {}).get("spec") or {}).get("containers", [{}])[0]
        # Kubernetes defaults a container's `resources` to `{}`, so "cleared" is the absence of
        # requests/limits rather than the absence of the key.
        remaining = container.get("resources") or {}
        assert not remaining.get("requests"), container
        assert not remaining.get("limits"), container
    finally:
        ui.api.request("DELETE", f"{DEPLOYMENTS}/{name}")
