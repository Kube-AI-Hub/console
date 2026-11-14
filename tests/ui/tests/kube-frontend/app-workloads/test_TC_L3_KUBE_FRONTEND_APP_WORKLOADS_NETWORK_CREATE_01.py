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
        ui.network_create_field("name").fill(name)
        ui.network_create_field("app").fill("network-test")
        ui.network_create_field("port").fill("8080")
        ui.network_create_field("targetPort").fill("80")
        ui.network_create_submit().click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=30_000)
        status, body = ui.api.request("GET", service)
        assert status == 200, body
        assert body["spec"]["selector"] == {"app": "network-test"}
        assert body["spec"]["ports"][0]["port"] == 8080
        assert body["spec"]["ports"][0]["targetPort"] == 80

        ui.open("ingresses")
        ui.network_create_button("ingresses").click()
        ui.network_create_field("name").fill(name)
        ui.network_create_field("host").fill(f"{name}.example.invalid")
        ui.network_create_field("path").fill("/test")
        ui.network_create_field("serviceName").fill(name)
        ui.network_create_field("servicePort").fill("8080")
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
