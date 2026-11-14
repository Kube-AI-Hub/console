from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SERVICES = "/api/v1/namespaces/default/services"
INGRESSES = "/apis/networking.k8s.io/v1/namespaces/default/ingresses"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CREATE_SERVICE_INGRESS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01 创建服务与应用路由：NodePort、选择器、多规则与同名报错。"""

    ui = app_workloads_page
    assert ui.api is not None
    suffix = uuid4().hex[:8]
    deploy = f"tc-e2e-dep-{suffix}"
    app_label = f"tc-e2e-app-{suffix}"
    service_name = f"tc-e2e-svc-{suffix}"
    ingress_name = f"tc-e2e-ing-{suffix}"
    host = f"{ingress_name}.example.invalid"

    try:
        # A workload with a unique app label is the selector source the dialog prefills from.
        ui.create_deployment(deploy, replicas=1, app=app_label)

        # ---------------- Service: NodePort + selector from workload labels ----------------
        ui.open("services")
        expect(ui.page.locator('[data-ai-id="services:create"]')).to_be_enabled()
        ui.network_create_button("services").click()
        expect(ui.network_create_dialog("services")).to_be_visible()

        ui.service_create_field("name").fill(service_name)
        ui.choose_select("services-create:type", "NodePort")
        # The conditional field is the reason this form exists: a ClusterIP service has
        # no node port, so showing it for every type would invite a setting that is ignored.
        expect(ui.service_create_field("node-port")).to_be_visible()
        ui.service_create_field("port").fill("8080")
        ui.service_create_field("target-port").fill("80")
        ui.choose_select("services-create:selector", app_label)
        ui.network_create_submit().click()
        ui.wait_dialog_closed()

        status, body = ui.api.request("GET", f"{SERVICES}/{service_name}")
        assert status == 200, body
        spec = body["spec"]
        assert spec["type"] == "NodePort", spec
        assert spec["selector"] == {"app": app_label}, spec
        ports = spec["ports"]
        assert ports[0]["port"] == 8080 and ports[0]["targetPort"] == 80, ports
        # Left empty on purpose: the cluster assigns from its node-port range.
        assert isinstance(ports[0].get("nodePort"), int), ports

        # ---------------- Duplicate name: the dialog stays open and explains ----------------
        ui.network_create_button("services").click()
        expect(ui.network_create_dialog("services")).to_be_visible()
        ui.service_create_field("name").fill(service_name)
        ui.service_create_field("port").fill("8080")
        ui.service_create_field("target-port").fill("80")
        ui.choose_select("services-create:selector", app_label)
        ui.network_create_submit().click()
        expect(ui.page.get_by_role("dialog")).to_be_visible()
        expect(ui.service_create_field("error")).to_contain_text("已存在")
        ui.page.get_by_role("dialog").get_by_role("button", name="取消").click()
        ui.wait_dialog_closed()

        # ---------------- Ingress: add/remove rules, group by host ----------------
        ui.open("ingresses")
        ui.network_create_button("ingresses").click()
        expect(ui.network_create_dialog("ingresses")).to_be_visible()
        ui.ingress_create_field("name").fill(ingress_name)
        ui.ingress_rule_field("host").fill(host)
        ui.ingress_rule_field("path").fill("/api")
        ui.ingress_rule_field("backend").fill(service_name)
        ui.ingress_rule_field("backend-port").fill("8080")

        # Removing a row is part of the editor, not a second path with its own dialog.
        ui.ingress_create_field("rule-add").click()
        expect(ui.ingress_rule_field("host", 1)).to_be_visible()
        ui.ingress_rule_remove(1).click()
        expect(ui.page.locator('[data-ai-id^="ingresses-create:host:"]')).to_have_count(1)

        ui.ingress_create_field("rule-add").click()
        ui.ingress_rule_field("host", 1).fill(host)
        ui.ingress_rule_field("path", 1).fill("/static")
        ui.ingress_rule_field("backend", 1).fill(service_name)
        ui.ingress_rule_field("backend-port", 1).fill("http")
        ui.network_create_submit().click()
        ui.wait_dialog_closed()

        status, body = ui.api.request("GET", f"{INGRESSES}/{ingress_name}")
        assert status == 200, body
        rules = (body.get("spec") or {}).get("rules") or []
        # Two paths on one host are one Kubernetes rule with two http.paths entries.
        assert len(rules) == 1, rules
        assert rules[0]["host"] == host, rules
        paths = rules[0]["http"]["paths"]
        assert [path["path"] for path in paths] == ["/api", "/static"], paths
        assert paths[0]["backend"]["service"] == {"name": service_name, "port": {"number": 8080}}, paths
        assert paths[1]["backend"]["service"] == {"name": service_name, "port": {"name": "http"}}, paths
        screenshot(ui.page, "create-service-ingress")
    finally:
        ui.api.request("DELETE", f"{INGRESSES}/{ingress_name}")
        ui.api.request("DELETE", f"{SERVICES}/{service_name}")
        ui.delete_deployment(deploy)
