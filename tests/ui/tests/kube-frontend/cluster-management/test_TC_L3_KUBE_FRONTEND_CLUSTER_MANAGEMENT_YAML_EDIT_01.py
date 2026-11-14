from __future__ import annotations

import time
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

STORAGE_CLASSES = "/apis/storage.k8s.io/v1/storageclasses"
NETWORK_POLICIES = "/apis/networking.k8s.io/v1/namespaces/default/networkpolicies"
KAPIS = "/kapis/resources.kubesphere.io/v1alpha3"


def _get(ui, path: str) -> tuple[int, dict]:
    return ui.api.request("GET", path)


def _wait_annotation(ui, name: str, key: str, value: str, timeout: float = 30) -> None:
    deadline = time.time() + timeout
    seen: dict = {}
    while time.time() < deadline:
        status, body = _get(ui, f"{STORAGE_CLASSES}/{name}")
        seen = ((body.get("metadata") or {}).get("annotations") or {})
        if status == 200 and seen.get(key) == value:
            return
        time.sleep(0.25)
    raise AssertionError(f"storageclass {name} annotations are {seen!r}, expected {key}={value}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_YAML_EDIT_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01 编辑 YAML：存储类型改注解，四类详情页都有入口。"""

    ui = cluster_management_page
    assert ui.api is not None
    suffix = uuid4().int % 1_000_000
    sc_name = f"tc-e2e-sc{suffix}"
    policy_name = f"tc-e2e-np{suffix}"
    annotation_key = "tc-e2e.io/yaml-edit"
    annotation_value = f"value-{suffix}"

    try:
        # ---- fixture: a storage class we are allowed to edit and delete ----
        status, body = ui.api.request(
            "POST",
            STORAGE_CLASSES,
            {
                "apiVersion": "storage.k8s.io/v1",
                "kind": "StorageClass",
                "metadata": {"name": sc_name},
                "provisioner": "kubernetes.io/no-provisioner",
                "volumeBindingMode": "WaitForFirstConsumer",
            },
        )
        assert status in (200, 201), (status, body)

        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses/{sc_name}")
        surface = ui.page.locator('[data-ai-id="sc-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        # The action exists and seeds the editor from the stored object.
        edit_button = ui.page.locator('[data-ai-id="sc-detail:edit-yaml"]')
        expect(edit_button).to_be_visible()
        edit_button.click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        expect(dialog.locator(".cm-content").first).to_contain_text(sc_name)

        # Upload a document instead of typing into CodeMirror: the dialog's upload
        # path is the same one a user takes, and it exercises the parser.
        document = (
            "apiVersion: storage.k8s.io/v1\n"
            "kind: StorageClass\n"
            "metadata:\n"
            f"  name: {sc_name}\n"
            "  annotations:\n"
            f"    {annotation_key}: {annotation_value}\n"
            "provisioner: kubernetes.io/no-provisioner\n"
            "volumeBindingMode: WaitForFirstConsumer\n"
        )
        dialog.locator('input[type="file"]').set_input_files(
            {"name": "storageclass.yaml", "mimeType": "text/yaml", "buffer": document.encode("utf-8")}
        )
        expect(dialog.locator(".cm-content").first).to_contain_text(annotation_key)

        ui.page.locator('[data-ai-id="yaml:submit"]').click()
        expect(dialog).to_have_count(0, timeout=30_000)
        _wait_annotation(ui, sc_name, annotation_key, annotation_value)

        status, body = _get(ui, f"{STORAGE_CLASSES}/{sc_name}")
        assert status == 200, (status, body)
        assert (body.get("metadata") or {}).get("name") == sc_name, body
        # The untouched spec fields survive the write.
        assert body.get("provisioner") == "kubernetes.io/no-provisioner", body

        # ---- a document that does not parse cannot be submitted ----
        edit_button.click()
        expect(dialog).to_be_visible()
        dialog.locator('input[type="file"]').set_input_files(
            {"name": "broken.yaml", "mimeType": "text/yaml", "buffer": b"metadata: [unclosed"}
        )
        expect(ui.page.locator('[data-ai-id="yaml:submit"]')).to_be_disabled()
        dialog.get_by_role("button", name="取消").click()
        expect(dialog).to_have_count(0)

        # ---- the same action is offered on the other three details ----
        status, body = _get(ui, f"{KAPIS}/nodes?limit=1")
        assert status == 200, (status, body)
        nodes = (body.get("items") or []) if isinstance(body, dict) else []
        if nodes:
            node_name = (nodes[0].get("metadata") or {}).get("name")
            ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes/{node_name}")
            expect(ui.page.locator('[data-ai-id="node-detail:surface"]').last).to_be_visible(timeout=30_000)
            expect(ui.page.locator('[data-ai-id="node-detail:edit-yaml"]')).to_be_visible()

        status, body = _get(ui, "/api/v1/persistentvolumes")
        volumes = (body.get("items") or []) if isinstance(body, dict) else []
        if volumes:
            pv_name = (volumes[0].get("metadata") or {}).get("name")
            ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/persistentvolumes/{pv_name}")
            expect(ui.page.locator('[data-ai-id="pv-detail:surface"]').last).to_be_visible(timeout=30_000)
            expect(ui.page.locator('[data-ai-id="pv-detail:edit-yaml"]')).to_be_visible()

        # NetworkPolicy now has a detail page to hold its YAML editor.
        status, body = ui.api.request(
            "POST",
            NETWORK_POLICIES,
            {
                "apiVersion": "networking.k8s.io/v1",
                "kind": "NetworkPolicy",
                "metadata": {"name": policy_name, "namespace": "default"},
                "spec": {"podSelector": {}, "policyTypes": ["Ingress"]},
            },
        )
        assert status in (200, 201), (status, body)
        ui.page.goto(
            f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}"
            f"/projects/default/networkpolicies/{policy_name}"
        )
        expect(ui.page.locator('[data-ai-id="networkpolicy-detail:surface"]').last).to_be_visible(timeout=30_000)
        expect(ui.page.locator('[data-ai-id="networkpolicy-detail:edit-yaml"]')).to_be_visible()

        screenshot(ui.page, "yaml-edit")
    finally:
        ui.api.request("DELETE", f"{STORAGE_CLASSES}/{sc_name}")
        ui.api.request("DELETE", f"{NETWORK_POLICIES}/{policy_name}")
