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
IPPOOLS = "/apis/network.kubesphere.io/v1alpha1/ippools"


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


def _template(body: dict) -> dict:
    return (body.get("spec") or {}).get("template") or {}


def _open(ui, origin: str, name: str):
    ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/deployments/{name}")
    surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
    expect(surface).to_be_visible(timeout=60_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
    expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
    expect(ui.page.locator('[data-ai-id="deployments-edit:security-context"]')).to_be_visible(timeout=20_000)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_SETTINGS_08(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-08 编辑设置：容器组安全上下文与 IP 池。"""

    ui = app_workloads_page
    assert ui.api is not None
    origin = ui.base.split("/kube-frontend/")[0]
    name = f"tc-e2e-sc-{uuid.uuid4().hex[:8]}"

    status, pools = ui.api.request("GET", IPPOOLS)
    available = []
    if status == 200 and isinstance(pools, dict):
        available = [item for item in pools.get("items") or [] if not ((item.get("spec") or {}).get("disabled") is True)]

    try:
        _create_deployment(ui.api, name)
        _open(ui, origin, name)

        ui.page.locator('[data-ai-id="deployments-edit:security-context-enable"]').check()
        # A non-numeric user id is refused locally.
        ui.page.locator('[data-ai-id="deployments-edit:security-context-user"]').fill("abc")
        expect(ui.page.locator('[data-ai-id="deployments-edit:security-context-error"]')).to_be_visible(timeout=10_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_disabled()

        ui.page.locator('[data-ai-id="deployments-edit:security-context-nonroot"]').check()
        ui.page.locator('[data-ai-id="deployments-edit:security-context-user"]').fill("1000")
        ui.page.locator('[data-ai-id="deployments-edit:security-context-group"]').fill("2000")

        if available:
            pool_name = available[0]["metadata"]["name"]
            expect(ui.page.locator('[data-ai-id="deployments-edit:ip-pool"]')).to_be_visible(timeout=20_000)
            ui.page.locator('[data-ai-id="deployments-edit:ip-pool-select"]').click()
            ui.page.get_by_role("option", name=f"{pool_name}（{available[0]['spec']['cidr']}）", exact=True).click()
        else:
            # Without a pool the control is absent rather than empty.
            expect(ui.page.locator('[data-ai-id="deployments-edit:ip-pool"]')).to_have_count(0)
            pool_name = ""

        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_enabled(timeout=10_000)
        screenshot(ui.page, "workload-edit-security")
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)

        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200, (status, body)
        template = _template(body)
        context = (template.get("spec") or {}).get("securityContext") or {}
        assert context.get("runAsNonRoot") is True, context
        assert context.get("runAsUser") == 1000, context
        assert context.get("runAsGroup") == 2000, context
        if pool_name:
            annotations = (template.get("metadata") or {}).get("annotations") or {}
            assert annotations.get("cni.projectcalico.org/ipv4pools") == f'["{pool_name}"]', annotations

        # Turning the block off removes it again.
        ui.page.reload(wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="deployments-detail:surface"]').last).not_to_have_attribute(
            "data-ai-state", "loading", timeout=60_000
        )
        _open(ui, origin, name)
        expect(ui.page.locator('[data-ai-id="deployments-edit:security-context-enable"]')).to_be_checked(timeout=20_000)
        ui.page.locator('[data-ai-id="deployments-edit:security-context-enable"]').uncheck()
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        pod_spec = (_template(body).get("spec") or {})
        # The apiserver defaults a pod securityContext to {}, so "cleared" is an empty block.
        assert not (pod_spec.get("securityContext") or {}), pod_spec.get("securityContext")
    finally:
        ui.api.request("DELETE", f"{DEPLOYMENTS}/{name}")
