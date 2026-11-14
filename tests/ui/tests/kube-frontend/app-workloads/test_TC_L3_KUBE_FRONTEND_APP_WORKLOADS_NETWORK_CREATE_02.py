import json
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_NETWORK_CREATE_02(app_workloads_page):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-02 YAML 创建保留完整配置。"""
    ui = app_workloads_page
    assert ui.api is not None
    name = f"tc-e2e-network-yaml-{uuid.uuid4().hex[:8]}"
    path = f"/api/v1/namespaces/{ui.namespace}/services/{name}"
    manifest = {
        "apiVersion": "v1", "kind": "Service",
        "metadata": {"name": name, "namespace": ui.namespace, "annotations": {"test-extra": "preserved"}},
        "spec": {"selector": {"app": "network-test"}, "ports": [
            {"name": "http", "port": 80, "targetPort": "http", "protocol": "TCP"},
            {"name": "https", "port": 443, "targetPort": 8443, "protocol": "TCP"},
        ]},
    }
    try:
        ui.open("services")
        ui.network_create_button("services").click()
        ui.network_create_field("name").fill(name)
        ui.network_yaml_switch("services").click()
        editor = ui.network_yaml_editor()
        expect(editor).to_be_visible()
        editor.fill(json.dumps(manifest))
        ui.network_yaml_submit("services").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", path)
        assert status == 200, body
        assert body["spec"]["ports"] == manifest["spec"]["ports"]
        assert body["metadata"]["annotations"]["test-extra"] == "preserved"
    finally:
        ui.api.request("DELETE", path)
