from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

FEDERATED = "/apis/types.kubefed.io/v1beta1"
NAMESPACES = FEDERATED + "/federatednamespaces"
SURFACE = '[data-ai-id="federated-resource:surface"]'
PROJECT_SURFACE = '[data-ai-id="federated-project:surface"]'
COLLECTION = FEDERATED + "/namespaces/{ns}/federatedconfigmaps"
OBJECT = COLLECTION + "/{name}"
LOCAL_CONFIGMAP = "/api/v1/namespaces/{ns}/configmaps/{name}"


def _workspace_of(item: dict) -> str:
    template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
    labels = (item.get("metadata") or {}).get("labels") or {}
    return template.get("kubesphere.io/workspace") or labels.get("kubesphere.io/workspace") or ""


def _wait_until(predicate, timeout: float = 45.0, interval: float = 2.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(interval)
    return predicate()


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_03(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-03 联邦资源详情。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", NAMESPACES)
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取联邦项目（federatednamespaces）")
    projects = [
        item
        for item in (body.get("items") or [])
        if (item.get("metadata") or {}).get("name") and _workspace_of(item)
    ]
    if not projects:
        pytest.skip("没有带 workspace 标签的 FederatedNamespace")

    project = projects[0]
    name = (project.get("metadata") or {}).get("name")
    namespace = (project.get("metadata") or {}).get("namespace") or name
    workspace = _workspace_of(project)

    object_name = f"tc-e2e-fedcm-{uuid.uuid4().hex[:8]}"
    create_body = {
        "apiVersion": "types.kubefed.io/v1beta1",
        "kind": "FederatedConfigMap",
        "metadata": {"name": object_name, "namespace": namespace},
        "spec": {
            "placement": {"clusterSelector": {}},
            "template": {
                "metadata": {"name": object_name, "namespace": namespace},
                "data": {"tc-probe": "yes"},
            },
        },
    }

    status, created = ui.api.request("POST", COLLECTION.format(ns=namespace), create_body)
    assert status in (200, 201), (status, created)
    try:
        # The control plane reports distribution a few seconds after creation.
        reported = _wait_until(
            lambda: (
                ui.api.request("GET", OBJECT.format(ns=namespace, name=object_name))[1] or {}
            ).get("status", {}).get("clusters")
        )
        assert reported, "联邦控制面在超时内没有回报分发集群"

        status, project_body = ui.api.request("GET", NAMESPACES)
        assert status == 200

        ui.page.goto(
            f"{ui.base_url}/kube-frontend/workspaces/{workspace}/federatedprojects/{name}"
        )
        surface = ui.page.locator(PROJECT_SURFACE).last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        ui.page.locator('[data-ai-id="federated-project:tab:config:trigger"]').click()
        row_link = ui.page.locator(
            f'[data-ai-id="federated-project:resource:configmaps/{object_name}"]'
        )
        expect(row_link).to_be_visible(timeout=60_000)
        href = row_link.get_attribute("href") or ""
        assert href.endswith(
            f"/federatedprojects/{name}/configmaps/{object_name}"
        ), href
        row_link.click()

        resource = ui.page.locator(SURFACE).last
        expect(resource).to_be_visible(timeout=30_000)
        expect(resource).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        assert resource.get_attribute("data-ai-state") == "ready", resource.get_attribute("data-ai-state")

        expect(ui.page.locator('[data-ai-id="federated-resource:title"]')).to_have_text(object_name)
        assert "FederatedConfigMap" in ui.page.locator('[data-ai-id="federated-resource:kind"]').inner_text()

        template = ui.page.locator('[data-ai-id="federated-resource:template"]')
        expect(template).to_be_visible()
        template_text = template.inner_text()
        assert "tc-probe" in template_text and "yes" in template_text, template_text

        distribution = ui.page.locator('[data-ai-id="federated-resource:distribution"]')
        expect(distribution).to_be_visible()
        distribution_text = distribution.inner_text()
        assert "host" in distribution_text, distribution_text
        condition_rows = distribution.locator("tbody tr[data-ai-row]")
        assert condition_rows.count() >= 1, distribution_text
        assert "Propagation" in distribution_text, distribution_text

        screenshot(ui.page, "federated-resource-detail")

        # Back link returns to the project detail (plain anchor, full navigation).
        ui.page.locator('[data-ai-id="federated-resource:back"]').click()
        expect(ui.page.locator(PROJECT_SURFACE).last).to_be_visible(timeout=30_000)

        # Not-found is a first-class result for every console segment.
        for segment in ("deployments", "services"):
            ui.page.goto(
                f"{ui.base_url}/kube-frontend/workspaces/{workspace}/federatedprojects/"
                f"{name}/{segment}/does-not-exist"
            )
            not_found = ui.page.locator('[data-ai-id="federated-resource:not-found"]')
            expect(not_found).to_be_visible(timeout=30_000)
            assert "不存在" in not_found.inner_text(), not_found.inner_text()

        ui.page.goto(
            f"{ui.base_url}/kube-frontend/workspaces/{workspace}/federatedprojects/"
            f"{name}/widgets/does-not-exist"
        )
        unknown = ui.page.locator('[data-ai-id="federated-resource:not-found"]')
        expect(unknown).to_be_visible(timeout=30_000)
        assert "未知的联邦资源类型" in unknown.inner_text(), unknown.inner_text()
    finally:
        ui.api.request("DELETE", OBJECT.format(ns=namespace, name=object_name))
        _wait_until(
            lambda: ui.api.request("GET", OBJECT.format(ns=namespace, name=object_name))[0] == 404
        )
        # Defensive: a federated delete cascades the local copy, but verify and remove it.
        local_path = LOCAL_CONFIGMAP.format(ns=namespace, name=object_name)
        if ui.api.request("GET", local_path)[0] == 200:
            ui.api.request("DELETE", local_path)
