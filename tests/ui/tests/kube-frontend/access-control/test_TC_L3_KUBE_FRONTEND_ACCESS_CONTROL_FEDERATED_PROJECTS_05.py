from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

from pages.federated_page import FederatedProjectsPageObject

pytestmark = pytest.mark.ui


def _workspace(fed: FederatedProjectsPageObject) -> str:
    for item in fed.project_names():
        template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
        if template.get("kubesphere.io/workspace"):
            return str(template["kubesphere.io/workspace"])
    known = fed.workspaces()
    assert known, "no workspace is visible to this account"
    return "system-workspace" if "system-workspace" in known else known[0]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_05(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-05 联邦项目编辑信息与调整部署集群。"""

    ui = access_control_page
    assert ui.api is not None
    fed = FederatedProjectsPageObject(ui.page, ui.base_url, api=ui.api)
    workspace = _workspace(fed)
    name = f"pwfed{uuid.uuid4().hex[:8]}"
    new_alias = "e2e-new-alias"
    new_description = "e2e 编辑后描述"

    try:
        fed.create_project(workspace=workspace, name=name, alias="old-alias", description="old-desc")
        fed.open_detail(workspace, name)

        # --- Edit information: alias/description only, delivered through overrides. ---
        fed.open_edit_info()
        fed.save_edit_info(alias=new_alias, description=new_description)

        deadline = time.time() + 30
        current = None
        while time.time() < deadline:
            current = fed.find_project(name) or {}
            annotations = (current.get("metadata") or {}).get("annotations") or {}
            if annotations.get("kubesphere.io/alias-name") == new_alias:
                break
            time.sleep(1)

        assert current, "project disappeared during edit"
        annotations = (current.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == new_alias, annotations
        assert annotations.get("kubesphere.io/description") == new_description, annotations
        assert annotations.get("kubesphere.io/creator"), "creator annotation must survive an edit"

        spec = current.get("spec") or {}
        template = ((spec.get("template") or {}).get("metadata") or {})
        assert not (template.get("annotations") or {}), "edit must not write template annotations"
        placed = [entry.get("name") for entry in (spec.get("placement") or {}).get("clusters") or []]
        assert placed == ["host"], placed
        overrides = spec.get("overrides") or []
        assert [entry.get("clusterName") for entry in overrides] == ["host"], overrides
        override_annotations = ((overrides[0].get("clusterOverrides") or [{}])[0].get("value") or {})
        assert override_annotations.get("kubesphere.io/alias-name") == new_alias, override_annotations

        # The detail page re-reads the project, so the new alias is visible.
        expect(ui.page.locator('[data-ai-id="federated-project:title"]')).to_have_text(new_alias, timeout=30_000)
        basic = ui.page.locator('[data-ai-id="federated-project:basic"]').inner_text()
        assert new_description in basic, basic
        screenshot(ui.page, "federated-projects-edit-info")

        # --- Placement dialog: reflects the current cluster, removes nothing here. ---
        fed.open_placement()
        dialog = fed.create_dialog()
        expect(dialog).to_be_visible()
        picker = dialog.locator('[data-ai-id="federated-projects:placement-clusters"]')
        expect(picker).to_contain_text("host")
        expect(dialog.locator('[data-ai-id="federated-projects:placement-removal"]')).to_have_count(0)
        fed.submit_placement()
        expect(dialog).to_be_hidden(timeout=30_000)

        settled = fed.find_project(name) or {}
        spec = settled.get("spec") or {}
        placed = [entry.get("name") for entry in (spec.get("placement") or {}).get("clusters") or []]
        assert placed == ["host"], placed
        overrides = spec.get("overrides") or []
        assert [entry.get("clusterName") for entry in overrides] == ["host"], overrides
        assert ((overrides[0].get("clusterOverrides") or [{}])[0].get("value") or {}).get(
            "kubesphere.io/alias-name"
        ) == new_alias, overrides
    finally:
        fed.delete_project(name)
        assert fed.find_project(name) is None
