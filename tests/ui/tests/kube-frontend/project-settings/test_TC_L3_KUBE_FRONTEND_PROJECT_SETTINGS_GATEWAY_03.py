from __future__ import annotations

import time
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from helpers.access_review import install_access_review_mock
from pages.project_settings import ProjectSettingsPage

pytestmark = pytest.mark.ui


def _wait_until(predicate, timeout_seconds: float = 90, interval: float = 2) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def _deny_update(page) -> None:
    """Forbid `update` but allow `delete`.

    The page asks one question per verb, so denying only update must hide the edit
    action while leaving delete (and the row action menu itself) present.
    """
    install_access_review_mock(page, lambda attributes: attributes.get("verb") != "update")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_GATEWAY_03(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03 网关设置：集群侧项目网关列表、行编辑/删除与无权限说明。"""

    ui: ProjectSettingsPage = project_settings_page
    assert ui.api is not None
    namespace = "e2e-gw-" + uuid4().hex[:8]
    gateway_name = "kubesphere-router-" + namespace

    try:
        assert ui.create_test_namespace(namespace), "创建临时命名空间失败"
        assert ui.create_project_gateway(namespace) is not None, "创建项目网关失败"
        service = ui.wait_router_service(namespace, timeout_seconds=120)
        assert service is not None, "网关 Service 未在超时内创建"
        assigned = {
            str(port.get("name")): int(port.get("nodePort"))
            for port in (service.get("spec") or {}).get("ports") or []
            if port.get("nodePort")
        }

        # ---- 项目页签的列与行数据来自 Gateway spec + Service ----
        ui.open_cluster_gateways("project")
        ui.wait_cluster_gateways_ready()
        headers = ui.cluster_gateway_headers()
        for expected in ("名称", "项目", "访问方式", "IP", "NodePort", "副本数", "链路追踪"):
            assert any(expected in header for header in headers), (expected, headers)
        row = ui.cluster_gateway_row(namespace, gateway_name)
        expect(row).to_be_visible(timeout=60_000)
        assert ui.cluster_gateway_cell(namespace, gateway_name, "type") == "NodePort"
        assert ui.cluster_gateway_cell(namespace, gateway_name, "replicas") == "1"
        assert ui.cluster_gateway_cell(namespace, gateway_name, "tracing") in ("关", "Off")
        shown_ports = ui.cluster_gateway_cell(namespace, gateway_name, "node-ports")
        for port in assigned.values():
            assert str(port) in shown_ports, (port, shown_ports)
        # NodePort 网关没有 LoadBalancer ingress，IP 如实显示 -，不是读取失败。
        assert ui.cluster_gateway_cell(namespace, gateway_name, "ip") == "-"

        # ---- 行编辑复用同一弹窗 ----
        ui.open_cluster_gateway_actions(namespace, gateway_name)
        ui.click_gateway_action("cluster-gateways:edit")
        expect(ui.gateway_dialog).to_be_visible(timeout=30_000)
        assert ui.gateway_replicas_value() == "1"
        ui.set_gateway_replicas("3")
        ui.save_gateway_edit()
        ui.wait_gateway_dialog_closed()
        assert _wait_until(lambda: ui.cluster_gateway_cell(namespace, gateway_name, "replicas") == "3")
        assert _wait_until(
            lambda: ((ui.gateway_object(namespace, gateway_name) or {}).get("spec") or {})
            .get("deployment", {})
            .get("replicas")
            == 3
        )

        # ---- SSAR 明确拒绝：行编辑入口隐藏 + 页面说明；列表仍显示对象 ----
        _deny_update(ui.page)
        ui.open_cluster_gateways("project")
        ui.wait_cluster_gateways_ready()
        expect(ui.page.locator('[data-ai-id="cluster-gateways:project-edit-denied"]')).to_be_visible(timeout=60_000)
        expect(row).to_be_visible(timeout=60_000)
        ui.open_cluster_gateway_actions(namespace, gateway_name)
        assert ui.cluster_gateway_action_visible("cluster-gateways:edit") is False, "无 update 权限时行编辑入口仍出现"
        assert ui.cluster_gateway_action_visible("cluster-gateways:delete") is True
        ui.page.keyboard.press("Escape")

        # 项目网关页同样隐藏编辑入口并说明
        ui.open_gateway(namespace)
        ui.wait_gateway_ready()
        expect(ui.page.locator('[data-ai-id="gateway:edit-denied"]')).to_be_visible(timeout=60_000)
        assert ui.gateway_edit_allowed() is False, "无 update 权限时项目页编辑入口仍出现"
        assert "权限" in ui.gateway_edit_denied_text()

        # ---- 移除拦截后行删除 ----
        ui.page.unroute("**/selfsubjectaccessreviews")
        ui.open_cluster_gateways("project")
        ui.wait_cluster_gateways_ready()
        ui.open_cluster_gateway_actions(namespace, gateway_name)
        ui.click_gateway_action("cluster-gateways:delete")
        confirm = ui.page.locator('[data-ai-id="cluster-gateways:project:delete-confirm"]')
        expect(confirm).to_be_visible(timeout=30_000)
        ui.page.locator('[data-ai-id="cluster-gateways:project:delete-input"]').fill(gateway_name)
        expect(confirm).to_be_enabled(timeout=10_000)
        confirm.click()
        # The Gateway carries the Helm finalizer, so the object can sit in terminating until
        # the release is cleaned up; finish our own object's deletion, then refresh the list
        # (its cache still holds the row that existed when the delete was issued).
        ui.delete_project_gateway(namespace)
        assert _wait_until(lambda: ui.gateway_object(namespace, gateway_name) is None, timeout_seconds=60)
        ui.page.locator('[data-ai-id="cluster-gateways:refresh"]').click()
        expect(ui.page.locator(f'[data-ai-row="{namespace}/{gateway_name}"]')).to_have_count(0, timeout=60_000)

        # ---- 空态（若没有并行同事创建的其他项目网关） ----
        ui.open_cluster_gateways("project")
        ui.wait_cluster_gateways_ready()
        if ui.cluster_gateways_surface.locator("[data-ai-row]").count() == 0:
            assert ui.cluster_gateways_surface.get_attribute("data-ai-state") == "empty"
            body_text = ui.cluster_gateways_surface.inner_text()
            assert "项目网关" in body_text and ("还没有" in body_text or "no project gateways" in body_text), body_text
        screenshot(ui.page, "cluster-gateways-project")
    finally:
        try:
            ui.page.unroute("**/selfsubjectaccessreviews")
        except Exception:  # noqa: BLE001 - cleanup must not mask the assertion
            pass
        ui.delete_project_gateway(namespace)
        ui.delete_test_namespace(namespace)
