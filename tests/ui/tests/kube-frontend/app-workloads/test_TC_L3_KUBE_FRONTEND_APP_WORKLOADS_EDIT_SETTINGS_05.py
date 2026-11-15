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


def _pair_row(page, group: str) -> str:
    """Add one row to a key/value group and return its id (the handle suffix)."""
    page.locator(f'[data-ai-id="edit-settings:{group}-add"]').click()
    rows = page.locator(f'[data-ai-id="edit-settings:{group}"] [data-ai-row]')
    expect(rows.last).to_be_visible(timeout=10_000)
    return (rows.last.get_attribute("data-ai-row") or "").split("-")[-1]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_SETTINGS_05(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-05 编辑设置：选择节点与容器组标签注解。"""

    ui = app_workloads_page
    assert ui.api is not None
    origin = ui.base.split("/kube-frontend/")[0]
    name = f"tc-e2e-adv-{uuid.uuid4().hex[:8]}"

    try:
        _create_deployment(ui.api, name)
        ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/deployments/{name}")
        surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
        expect(surface).to_be_visible(timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:advanced"]')).to_be_visible(timeout=20_000)

        # The pod template already carries the selector label; dropping it must be refused locally.
        label_rows = ui.page.locator('[data-ai-id="edit-settings:pod-labels"] [data-ai-row]')
        expect(label_rows).to_have_count(1, timeout=20_000)
        first_id = (label_rows.first.get_attribute("data-ai-row") or "").split("-")[-1]
        ui.page.locator(f'[data-ai-id="edit-settings:pod-labels-remove:{first_id}"]').click()
        expect(ui.page.locator('[data-ai-id="deployments-edit:selector-error"]')).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_disabled()

        # Put the selector label back and add a second label, an annotation and a node selector.
        label_id = _pair_row(ui.page, "pod-labels")
        ui.page.locator(f'[data-ai-id="edit-settings:pod-labels-key:{label_id}"]').fill("app")
        ui.page.locator(f'[data-ai-id="edit-settings:pod-labels-value:{label_id}"]').fill(name)

        extra_id = _pair_row(ui.page, "pod-labels")
        ui.page.locator(f'[data-ai-id="edit-settings:pod-labels-key:{extra_id}"]').fill("tier")
        ui.page.locator(f'[data-ai-id="edit-settings:pod-labels-value:{extra_id}"]').fill("backend")

        annotation_id = _pair_row(ui.page, "pod-annotations")
        ui.page.locator(f'[data-ai-id="edit-settings:pod-annotations-key:{annotation_id}"]').fill("prometheus.io/scrape")
        ui.page.locator(f'[data-ai-id="edit-settings:pod-annotations-value:{annotation_id}"]').fill("true")

        selector_id = _pair_row(ui.page, "node-selector")
        ui.page.locator(f'[data-ai-id="edit-settings:node-selector-key:{selector_id}"]').fill("kubernetes.io/os")
        ui.page.locator(f'[data-ai-id="edit-settings:node-selector-value:{selector_id}"]').fill("linux")

        expect(ui.page.locator('[data-ai-id="deployments-edit:selector-error"]')).to_have_count(0, timeout=10_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:submit"]')).to_be_enabled(timeout=10_000)
        screenshot(ui.page, "workload-edit-advanced")
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)

        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200, (status, body)
        template = (body.get("spec") or {}).get("template") or {}
        labels = (template.get("metadata") or {}).get("labels") or {}
        annotations = (template.get("metadata") or {}).get("annotations") or {}
        node_selector = (template.get("spec") or {}).get("nodeSelector") or {}
        assert labels.get("app") == name, labels
        assert labels.get("tier") == "backend", labels
        assert annotations.get("prometheus.io/scrape") == "true", annotations
        assert node_selector.get("kubernetes.io/os") == "linux", node_selector

        # Clearing the node selector removes the field instead of leaving an empty map.
        # Reload first: the dialog submits the whole object with the resourceVersion it was seeded
        # with, and a save landing while the detail query is still refetching answers 409.
        ui.page.reload(wait_until="domcontentloaded")
        expect(ui.page.locator('[data-ai-id="deployments-detail:surface"]').last).not_to_have_attribute(
            "data-ai-state", "loading", timeout=60_000
        )
        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        row = ui.page.locator('[data-ai-id="edit-settings:node-selector"] [data-ai-row]').first
        expect(row).to_be_visible(timeout=20_000)
        row_id = (row.get_attribute("data-ai-row") or "").split("-")[-1]
        ui.page.locator(f'[data-ai-id="edit-settings:node-selector-remove:{row_id}"]').click()
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{name}")
        template = (body.get("spec") or {}).get("template") or {}
        assert "nodeSelector" not in (template.get("spec") or {}), template.get("spec")
    finally:
        ui.api.request("DELETE", f"{DEPLOYMENTS}/{name}")
