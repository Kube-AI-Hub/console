from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_YAML_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01 编辑 YAML：预填对象并原样保存。"""

    ui = app_workloads_page
    name = ui.unique("yaml")
    try:
        ui.create_deployment(name, replicas=1)
        ui.open_detail("deployments", name)
        expect(ui.detail_edit_yaml_button).to_be_visible()

        ui.detail_edit_yaml_button.click()
        expect(ui.dialog).to_be_visible()

        document = ui.yaml_editor_text()
        # kapis strips the type metadata, so the document starts at `metadata`;
        # what the criterion requires is that it is *this* object, seeded from the
        # current detail rather than blank or a template.
        assert "metadata:" in document, document
        assert f"name: {name}" in document, document
        assert "namespace: default" in document, document

        # Saving an untouched document must be a no-op, not a rename or a wipe.
        ui.click("yaml:submit")
        ui.wait_dialog_closed()

        status, body = ui.get_deployment(name)
        assert status == 200, (status, body)
        assert body["metadata"]["name"] == name
        assert (body.get("spec") or {}).get("replicas") == 1
        screenshot(ui.page, "edit-yaml")
    finally:
        ui.delete_deployment(name)
