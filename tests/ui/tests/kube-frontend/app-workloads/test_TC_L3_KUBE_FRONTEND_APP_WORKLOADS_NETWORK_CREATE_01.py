from __future__ import annotations

import pytest
import uuid
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_NETWORK_CREATE_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01 服务与应用路由创建并回读。"""
    ui = app_workloads_page
    assert ui.api is not None
    name = f"tc-e2e-network-{uuid.uuid4().hex[:10]}"
    service = f"/api/v1/namespaces/{ui.namespace}/services/{name}"
    ingress = f"/apis/networking.k8s.io/v1/namespaces/{ui.namespace}/ingresses/{name}"
    try:
        ui.open("services")
        ui.network_create_button("services").click()
        expect(ui.network_create_dialog("services")).to_be_visible()
        ui.service_create_field("name").fill(name)
        ui.service_create_field("port").fill("8080")
        ui.service_create_field("target-port").fill("80")
        # Selector entry: pick 手动填写, then type the label. The prefilled path is
        # covered by the create-service case; this one pins that free text still works.
        ui.page.locator('[data-ai-id="services-create:selector"]').click()
        ui.page.get_by_role("option", name="手动填写", exact=True).click()
        ui.service_create_field("selector-manual").fill("network-test")
        ui.network_create_submit().click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", service)
        assert status == 200, body
        assert body["spec"]["selector"] == {"app": "network-test"}
        assert body["spec"]["ports"][0]["port"] == 8080
        assert body["spec"]["ports"][0]["targetPort"] == 80

        ui.open("ingresses")
        ui.network_create_button("ingresses").click()
        expect(ui.network_create_dialog("ingresses")).to_be_visible()
        ui.ingress_create_field("name").fill(name)
        ui.ingress_rule_field("host").fill(f"{name}.example.invalid")
        ui.ingress_rule_field("path").fill("/test")
        ui.ingress_rule_field("backend").fill(name)
        ui.ingress_rule_field("backend-port").fill("8080")
        ui.network_create_submit().click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", ingress)
        assert status == 200, body
        rule = body["spec"]["rules"][0]
        assert rule["host"] == f"{name}.example.invalid"
        path = rule["http"]["paths"][0]
        assert path["path"] == "/test"
        assert path["backend"]["service"] == {"name": name, "port": {"number": 8080}}
        screenshot(ui.page, "network-create")
    finally:
        ui.api.request("DELETE", ingress)
        ui.api.request("DELETE", service)
