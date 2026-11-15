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


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_SETTINGS_06(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-06 编辑设置：健康检查与优雅终止。"""

    ui = app_workloads_page
    assert ui.api is not None
    origin = ui.base.split("/kube-frontend/")[0]
    name = f"tc-e2e-health-{uuid.uuid4().hex[:8]}"

    try:
        _create_deployment(ui.api, name)
        ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/deployments/{name}")
        surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
        expect(surface).to_be_visible(timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:probes"]')).to_be_visible(timeout=20_000)

        # A command probe without a command cannot run; the dialog refuses it locally.
        ui.page.locator('[data-ai-id="deployments-edit:probe-enable:liveness"]').check()
        ui.page.locator('[data-ai-id="deployments-edit:probe-type:liveness"]').click()
        ui.page.get_by_role("option", name="命令", exact=True).click()
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_disabled(timeout=10_000)

        ui.page.locator('[data-ai-id="deployments-edit:probe-type:liveness"]').click()
        ui.page.get_by_role("option", name="HTTP", exact=True).click()
        ui.page.locator('[data-ai-id="deployments-edit:probe-port:liveness"]').fill("80")
        ui.page.locator('[data-ai-id="deployments-edit:probe-path:liveness"]').fill("/healthz")
        ui.page.locator('[data-ai-id="deployments-edit:probe-initialDelaySeconds:liveness"]').fill("5")

        # An out-of-range port is refused too.
        ui.page.locator('[data-ai-id="deployments-edit:probe-port:liveness"]').fill("70000")
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_disabled(timeout=10_000)
        ui.page.locator('[data-ai-id="deployments-edit:probe-port:liveness"]').fill("80")

        ui.page.locator('[data-ai-id="deployments-edit:grace-period-input"]').fill("45")
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_enabled(timeout=10_000)
        screenshot(ui.page, "workload-edit-health")
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)

        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200, (status, body)
        pod_spec = (((body.get("spec") or {}).get("template") or {}).get("spec") or {})
        assert pod_spec.get("terminationGracePeriodSeconds") == 45, pod_spec.get("terminationGracePeriodSeconds")
        container = (pod_spec.get("containers") or [{}])[0]
        probe = container.get("livenessProbe") or {}
        http_get = probe.get("httpGet") or {}
        assert http_get.get("path") == "/healthz", probe
        assert http_get.get("port") == 80, probe
        assert probe.get("initialDelaySeconds") == 5, probe
        # The other thresholds come from the apiserver's defaults; this case only asserts what it set.
        assert "readinessProbe" not in container, container

        # Turning the probe off removes the key instead of leaving an empty object.
        ui.page.reload(wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="deployments-detail:surface"]').last).not_to_have_attribute(
            "data-ai-state", "loading", timeout=60_000
        )
        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:probe-enable:liveness"]')).to_be_checked(timeout=20_000)
        ui.page.locator('[data-ai-id="deployments-edit:probe-enable:liveness"]').uncheck()
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        container = ((((body.get("spec") or {}).get("template") or {}).get("spec") or {}).get("containers") or [{}])[0]
        assert "livenessProbe" not in container, container
    finally:
        ui.api.request("DELETE", f"{DEPLOYMENTS}/{name}")
