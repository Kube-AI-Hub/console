from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

from pages.federated_page import FederatedProjectsPageObject

pytestmark = pytest.mark.ui


def _workspace(fed: FederatedProjectsPageObject) -> str:
    """A workspace that exists and can host projects; prefer the one with federated projects."""
    projects = fed.project_names()
    for item in projects:
        template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
        if template.get("kubesphere.io/workspace"):
            return str(template["kubesphere.io/workspace"])
    known = fed.workspaces()
    assert known, "no workspace is visible to this account"
    return "system-workspace" if "system-workspace" in known else known[0]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_04(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04 联邦项目创建：校验、两步写入与回读。"""

    ui = access_control_page
    assert ui.api is not None
    fed = FederatedProjectsPageObject(ui.page, ui.base_url, api=ui.api)
    workspace = _workspace(fed)
    name = f"pwfed{uuid.uuid4().hex[:8]}"
    alias = "e2e-别名"
    description = "e2e 创建回读"

    try:
        fed.open_list(workspace)
        create_button = fed.create_button()
        expect(create_button).to_be_visible()
        assert create_button.is_enabled(), "创建按钮在管理员身份下应可用"

        # The form validates before it writes: an empty submit must not create anything.
        fed.open_create()
        fed.submit_create()
        expect(fed.create_error().filter(has_text="请输入项目名称")).to_be_visible(timeout=10_000)
        assert fed.find_project(name) is None

        fed.fill_create(name="Bad_Name")
        fed.submit_create()
        expect(fed.create_error().filter(has_text="小写字母")).to_be_visible(timeout=10_000)

        fed.fill_create(name="a" * 64)
        fed.submit_create()
        expect(fed.create_error().filter(has_text="63")).to_be_visible(timeout=10_000)

        # A project needs a placement; clearing the picker must be caught.
        fed.fill_create(name=name, cluster_labels=[])
        fed.submit_create()
        expect(fed.create_error().filter(has_text="至少选择一个部署集群")).to_be_visible(timeout=10_000)
        assert fed.find_project(name) is None, "校验失败时不得发出创建请求"

        clusters = fed.clusters()
        ready = [item for item in clusters if (item.get("status") or {}).get("conditions")]
        assert ready, "there is no cluster to place the project on"
        host = (ready[0].get("metadata") or {}).get("name") or "host"

        fed.fill_create(name=name, alias=alias, description=description, cluster_labels=[host])
        fed.submit_create()
        expect(fed.create_dialog()).to_be_hidden(timeout=60_000)

        expect(fed.row(name)).to_be_visible(timeout=60_000)
        screenshot(ui.page, "federated-projects-create-list")

        created = fed.find_project(name)
        assert created, "created project is missing from the federated API"
        labels = (created.get("metadata") or {}).get("labels") or {}
        assert labels.get("kubesphere.io/workspace") == workspace, labels
        template = ((created.get("spec") or {}).get("template") or {}).get("metadata") or {}
        assert (template.get("labels") or {}).get("kubesphere.io/workspace") == workspace, template
        assert not (template.get("annotations") or {}), "template annotations are rejected by the control plane"
        spec = created.get("spec") or {}
        placed = [entry.get("name") for entry in (spec.get("placement") or {}).get("clusters") or []]
        assert placed == [host], placed
        overrides = spec.get("overrides") or []
        assert [entry.get("clusterName") for entry in overrides] == [host], overrides
        annotations = (created.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == alias, annotations
        assert annotations.get("kubesphere.io/description") == description, annotations
        override_annotations = ((overrides[0].get("clusterOverrides") or [{}])[0].get("value") or {})
        assert override_annotations.get("kubesphere.io/alias-name") == alias, override_annotations

        status, namespaces = ui.api.request("GET", "/api/v1/namespaces/" + name)
        assert status == 200, (status, namespaces)
        namespace_labels = (namespaces.get("metadata") or {}).get("labels") or {}
        assert namespace_labels.get("kubefed.io/managed") == "true", namespace_labels

        # The control plane reports propagation a moment after creation.
        deadline = time.time() + 45
        propagated = None
        while time.time() < deadline:
            current = fed.find_project(name) or {}
            conditions = (current.get("status") or {}).get("conditions") or []
            propagation = next((entry for entry in conditions if entry.get("type") == "Propagation"), None)
            if propagation and propagation.get("status") == "True":
                propagated = propagation
                break
            time.sleep(1)
        assert propagated, "control plane did not report Propagation=True"

        fed.open_detail(workspace, name)
        basic = ui.page.locator('[data-ai-id="federated-project:basic"]').inner_text()
        assert alias in basic, basic
        assert host in basic, basic
        assert workspace in basic, basic
        expect(ui.page.locator('[data-ai-id="federated-project:conditions"]')).to_be_visible()
        screenshot(ui.page, "federated-projects-create-detail")
    finally:
        fed.delete_project(name)
        assert fed.find_project(name) is None
        assert ui.api.request("GET", "/api/v1/namespaces/" + name)[0] == 404
