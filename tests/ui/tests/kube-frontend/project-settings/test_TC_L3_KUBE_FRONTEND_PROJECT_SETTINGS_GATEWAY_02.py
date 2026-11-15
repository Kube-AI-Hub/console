from __future__ import annotations

import time
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.project_settings import ProjectSettingsPage

pytestmark = pytest.mark.ui


def _wait_until(predicate, timeout_seconds: float = 90, interval: float = 2) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def _spec(gateway: dict | None) -> dict:
    return ((gateway or {}).get("spec") or {}) if gateway else {}


def _node_ports(service: dict | None) -> dict[str, int]:
    ports = (((service or {}).get("spec") or {}).get("ports") or []) if service else []
    return {str(port.get("name")): int(port.get("nodePort")) for port in ports if port.get("nodePort")}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_GATEWAY_02(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02 网关设置：编辑访问方式/副本数/追踪/注解/NodePort 与本地校验。"""

    ui: ProjectSettingsPage = project_settings_page
    assert ui.api is not None
    namespace = "e2e-gw-" + uuid4().hex[:8]
    gateway_name = "kubesphere-router-" + namespace

    try:
        assert ui.create_test_namespace(namespace), "创建临时命名空间失败"
        assert ui.create_project_gateway(namespace) is not None, "创建项目网关失败"
        service = ui.wait_router_service(namespace, timeout_seconds=120)
        assert service is not None, "网关 Service 未在超时内创建"
        assigned = _node_ports(service)
        assert assigned, f"Service 没有 NodePort: {service}"

        # ---- 信息区与弹窗默认值来自当前 spec/service ----
        ui.open_gateway(namespace)
        ui.wait_gateway_ready()
        expect(ui.page.locator('[data-ai-id="gateway:info"]')).to_be_visible(timeout=60_000)
        assert ui.gateway_field("type") == "NodePort"
        assert ui.gateway_field("replicas") == "1"
        assert ui.gateway_field("tracing") in ("关", "Off")
        assert "HTTP" in ui.gateway_field("node-ports")

        ui.open_gateway_edit()
        assert "NodePort" in ui.gateway_type_value(), ui.gateway_type_value()
        assert ui.gateway_replicas_value() == "1"

        # ---- 本地校验：非法值阻止保存且不产生写请求 ----
        writes: list[tuple[str, str]] = []
        ui.page.on("request", lambda request: writes.append((request.method, request.url))
                   if request.method in ("PUT", "PATCH", "POST", "DELETE") and "/gateways/" in request.url else None)

        ui.set_gateway_replicas("-1")
        expect(ui.page.locator('[data-ai-id="gateway:edit:replicas:error"]')).to_be_visible(timeout=10_000)
        assert ui.gateway_save_enabled() is False
        ui.set_gateway_replicas("1.5")
        assert ui.gateway_save_enabled() is False
        ui.set_gateway_node_port("http", "1234")
        expect(ui.page.locator('[data-ai-id="gateway:edit:node-port:http:error"]')).to_be_visible(timeout=10_000)
        ui.set_gateway_node_port("http", "31000")
        ui.set_gateway_node_port("https", "31000")
        expect(ui.page.locator('[data-ai-id="gateway:edit:node-port:https:error"]')).to_contain_text("不能重复", timeout=10_000)
        assert ui.gateway_save_enabled() is False
        writes_before = len(writes)
        ui.page.locator('[data-ai-id="gateway:edit:save"]').evaluate("el => el.click()")
        ui.page.wait_for_timeout(600)
        assert len(writes) == writes_before, f"非法输入时仍发出写请求: {writes[writes_before:]}"

        # ---- 修正为合法值，保存并回读 ----
        ui.set_gateway_replicas("2")
        ui.set_gateway_node_port("https", "31001")
        ui.set_gateway_tracing(True)
        expect(ui.page.locator('[data-ai-id="gateway:edit:save"]')).to_be_enabled(timeout=10_000)
        ui.save_gateway_edit()
        ui.wait_gateway_dialog_closed()

        def spec_saved() -> dict:
            return _spec(ui.gateway_object(namespace, gateway_name))

        assert _wait_until(lambda: spec_saved().get("deployment", {}).get("replicas") == 2), spec_saved()
        assert spec_saved().get("deployment", {}).get("annotations", {}).get("servicemesh.kubesphere.io/enabled") == "true"
        assert _wait_until(lambda: _node_ports(ui.router_service(namespace)).get("http") == 31000), _node_ports(ui.router_service(namespace))
        assert _node_ports(ui.router_service(namespace)) == {"http": 31000, "https": 31001}

        # 页面刷新后显示新值
        ui.open_gateway(namespace)
        ui.wait_gateway_ready()
        assert ui.gateway_field("replicas") == "2"
        assert ui.gateway_field("tracing") in ("开", "On")
        assert "31000" in ui.gateway_field("node-ports")

        # ---- 切换 LoadBalancer + 服务注解 ----
        ui.open_gateway_edit()
        ui.choose_gateway_type("LoadBalancer")
        expect(ui.page.locator('[data-ai-id="gateway:edit:annotation:add"]')).to_be_visible(timeout=10_000)
        ui.add_gateway_service_annotation("service.example/key", "v1")
        ui.save_gateway_edit()
        ui.wait_gateway_dialog_closed()
        assert _wait_until(lambda: spec_saved().get("service", {}).get("type") == "LoadBalancer"), spec_saved()
        assert spec_saved().get("service", {}).get("annotations") == {"service.example/key": "v1"}
        ui.open_gateway(namespace)
        ui.wait_gateway_ready()
        assert ui.gateway_field("type") == "LoadBalancer"

        screenshot(ui.page, "project-gateway-edit")
    finally:
        ui.delete_project_gateway(namespace)
        ui.delete_test_namespace(namespace)
