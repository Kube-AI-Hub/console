"""页面对象：kube-frontend 的项目设置（项目角色、项目成员）。

两张表共用一套列表组件（`SettingsListPage`），选择器只在这里出现。

IAM 数据走 `iam.kubesphere.io/v1alpha2`，不是通用资源代理；角色的权限明细只在
详情请求里返回，所以规则表用例必须单独取一次角色对象来对账。
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

#: IAM 聚合 API 的 kapis 前缀。
IAM_KAPIS = "/kapis/iam.kubesphere.io/v1alpha2"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class ProjectSettingsPage:
    """项目角色与项目成员列表，以及确认数据是否存在的辅助。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        namespace: str = "default",
        api: ApiLike | None = None,
    ) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.cluster = cluster
        self.namespace = namespace
        self.api = api

    def url(self, kind: str = "roles", namespace: str | None = None) -> str:
        ns = namespace or self.namespace
        return f"{self.base_url}/kube-frontend/system-workspace/clusters/{self.cluster}/projects/{ns}/{kind}"

    def surface(self, kind: str = "roles") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:surface"]').last

    def open(self, kind: str = "roles", namespace: str | None = None) -> None:
        url = self.url(kind, namespace)
        self.page.goto(url)
        try:
            expect(self.surface(kind)).to_be_visible(timeout=30_000)
        except AssertionError:
            # One reload only: the first paint occasionally loses the race with a slow
            # IAM call. A retry loop would hide a genuinely broken page.
            self.page.goto(url)
            expect(self.surface(kind)).to_be_visible(timeout=60_000)

    def wait_ready(self, kind: str = "roles", timeout_ms: int = 60_000) -> None:
        expect(self.surface(kind)).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, kind: str = "roles") -> str | None:
        return self.surface(kind).get_attribute("data-ai-state")

    def headers(self, kind: str = "roles") -> list[str]:
        return [t.strip() for t in self.surface(kind).locator("thead th:visible").all_inner_texts() if t.strip()]

    def rows(self, kind: str = "roles") -> Locator:
        return self.surface(kind).locator("[data-ai-row]")

    def row_names(self, kind: str = "roles") -> list[str]:
        values = self.surface(kind).locator("[data-ai-row]").evaluate_all(
            "els => els.map(e => e.getAttribute('data-ai-row'))"
        )
        return [str(v) for v in values]

    def active_tab(self) -> str | None:
        return self.page.locator('[data-ai-id^="area-tabs:"] a[aria-current="page"]').get_attribute("data-ai-id")

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    def open_row_action(self, name: str, action: str) -> None:
        self.surface("roles").locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    # ---------------- 数据 ----------------

    def list_roles(self, namespace: str | None = None) -> list[dict[str, Any]]:
        """该项目下的全部角色（用于与列表对账）。"""
        assert self.api is not None, "api client required"
        ns = namespace or self.namespace
        status, body = self.api.request("GET", f"{IAM_KAPIS}/namespaces/{ns}/roles?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("items") or []

    def role_rules(self, name: str, namespace: str | None = None) -> list[dict[str, Any]]:
        assert self.api is not None, "api client required"
        ns = namespace or self.namespace
        status, body = self.api.request("GET", f"{IAM_KAPIS}/namespaces/{ns}/roles/{name}")
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("rules") or []

    def list_members(self, namespace: str | None = None) -> list[dict[str, Any]]:
        assert self.api is not None, "api client required"
        ns = namespace or self.namespace
        status, body = self.api.request("GET", f"{IAM_KAPIS}/namespaces/{ns}/members?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("items") or []
    # ---------------- 项目网关（编辑设置与集群侧列表） ----------------

    #: 项目网关 CR 集合（原生 API；项目页与集群页读同一集合）。
    GATEWAYS = "/apis/gateway.kubesphere.io/v1alpha1/namespaces/{namespace}/gateways"
    #: Helm release 创建的网关 Service；NodePort/IP 只在这里。
    ROUTER_SERVICE = (
        "/kapis/resources.kubesphere.io/v1alpha3/namespaces/{namespace}/services/kubesphere-router-{namespace}"
    )

    def gateway_url(self, namespace: str | None = None) -> str:
        ns = namespace or self.namespace
        return f"{self.base_url}/kube-frontend/system-workspace/clusters/{self.cluster}/projects/{ns}/gateways"

    @property
    def gateway_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="gateway:surface"]').last

    def open_gateway(self, namespace: str | None = None) -> None:
        self.page.goto(self.gateway_url(namespace))
        expect(self.gateway_surface).to_be_visible(timeout=30_000)

    def wait_gateway_ready(self, timeout_ms: int = 90_000) -> None:
        expect(self.gateway_surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def gateway_field(self, field: str) -> str:
        return self.page.locator(f'[data-ai-id="gateway:{field}"]').last.inner_text().strip()

    def gateway_edit_allowed(self) -> bool:
        return self.page.locator('[data-ai-id="gateway:edit"]').count() > 0

    def gateway_edit_denied_text(self) -> str:
        locator = self.page.locator('[data-ai-id="gateway:edit-denied"]')
        return locator.inner_text().strip() if locator.count() else ""

    # ---- 编辑弹窗 ----

    @property
    def gateway_dialog(self) -> Locator:
        return self.page.get_by_role("dialog").last

    def open_gateway_edit(self) -> None:
        self.page.locator('[data-ai-id="gateway:edit"]').click()
        expect(self.gateway_dialog).to_be_visible(timeout=30_000)

    def choose_gateway_type(self, label: str) -> None:
        self.page.locator('[data-ai-id="gateway:edit:type"]').click()
        self.page.get_by_role("option", name=label, exact=True).click()

    def gateway_type_value(self) -> str:
        return (self.page.locator('[data-ai-id="gateway:edit:type"]').inner_text() or "").strip()

    def set_gateway_replicas(self, value: str) -> None:
        self.page.locator('[data-ai-id="gateway:edit:replicas"]').fill(value)

    def gateway_replicas_value(self) -> str:
        return self.page.locator('[data-ai-id="gateway:edit:replicas"]').input_value()

    def set_gateway_tracing(self, enabled: bool) -> None:
        switch = self.page.locator('[data-ai-id="gateway:edit:tracing"]')
        checked = switch.get_attribute("data-state") == "checked"
        if checked != enabled:
            switch.click()

    def set_gateway_node_port(self, port: str, value: str) -> None:
        self.page.locator(f'[data-ai-id="gateway:edit:node-port:{port}"]').fill(value)

    def gateway_node_port_value(self, port: str) -> str:
        return self.page.locator(f'[data-ai-id="gateway:edit:node-port:{port}"]').input_value()

    def add_gateway_service_annotation(self, key: str, value: str) -> None:
        self.page.locator('[data-ai-id="gateway:edit:annotation:add"]').click()
        self.page.locator('[data-ai-id="gateway:edit:annotation:key:0"]').fill(key)
        self.page.locator('[data-ai-id="gateway:edit:annotation:value:0"]').fill(value)

    def gateway_edit_error(self, field: str) -> str:
        locator = self.page.locator(f'[data-ai-id="gateway:edit:{field}:error"]')
        return locator.inner_text().strip() if locator.count() else ""

    def gateway_edit_error_ids(self) -> list[str]:
        return [
            str(value)
            for value in self.page.locator('[data-ai-id^="gateway:edit:"][data-ai-id$=":error"]').evaluate_all(
                "els => els.map(e => e.getAttribute('data-ai-id'))"
            )
        ]

    def gateway_save_enabled(self) -> bool:
        return self.page.locator('[data-ai-id="gateway:edit:save"]').is_enabled()

    def save_gateway_edit(self) -> None:
        self.page.locator('[data-ai-id="gateway:edit:save"]').click()

    def wait_gateway_dialog_closed(self, timeout_ms: int = 60_000) -> None:
        expect(self.page.locator('[data-ai-id="gateway:edit:save"]')).to_have_count(0, timeout=timeout_ms)

    # ---- 集群侧项目网关列表 ----

    def cluster_gateways_url(self, component: str = "project") -> str:
        return f"{self.base_url}/kube-frontend/clusters/{self.cluster}/gateways/{component}"

    @property
    def cluster_gateways_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-gateways:surface"]').last

    def open_cluster_gateways(self, component: str = "project") -> None:
        self.page.goto(self.cluster_gateways_url(component))
        expect(self.cluster_gateways_surface).to_be_visible(timeout=30_000)

    def wait_cluster_gateways_ready(self, timeout_ms: int = 90_000) -> None:
        expect(self.cluster_gateways_surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def cluster_gateway_headers(self) -> list[str]:
        return [
            text.strip()
            for text in self.cluster_gateways_surface.locator("thead th:visible").all_inner_texts()
            if text.strip()
        ]

    def cluster_gateway_row(self, namespace: str, name: str) -> Locator:
        return self.cluster_gateways_surface.locator(f'[data-ai-row="{namespace}/{name}"]').last

    def cluster_gateway_cell(self, namespace: str, name: str, cell: str) -> str:
        locator = self.page.locator(f'[data-ai-id="cluster-gateways:cell:{cell}:{namespace}/{name}"]')
        return locator.inner_text().strip() if locator.count() else ""

    def open_cluster_gateway_actions(self, namespace: str, name: str) -> None:
        self.cluster_gateway_row(namespace, name).locator('button[aria-label="更多操作"], button[aria-label="More actions"]').click()

    def click_gateway_action(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').last.click()

    def cluster_gateway_action_visible(self, ai_id: str) -> bool:
        return self.page.locator(f'[data-ai-id="{ai_id}"]').count() > 0

    # ---- 网关 API（写入用唯一前缀对象，失败也清理） ----

    def _api(self):
        assert self.api is not None, "api client required"
        return self.api

    def gateway_objects(self, namespace: str) -> list[dict[str, Any]]:
        status, body = self._api().request("GET", self.GATEWAYS.format(namespace=namespace))
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("items") or []

    def gateway_object(self, namespace: str, name: str) -> dict[str, Any] | None:
        status, body = self._api().request("GET", f"{self.GATEWAYS.format(namespace=namespace)}/{name}")
        if status != 200 or not isinstance(body, dict):
            return None
        return body

    def router_service(self, namespace: str) -> dict[str, Any] | None:
        status, body = self._api().request("GET", self.ROUTER_SERVICE.format(namespace=namespace))
        if status != 200 or not isinstance(body, dict):
            return None
        return body

    def wait_router_service(self, namespace: str, timeout_seconds: int = 90) -> dict[str, Any] | None:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            service = self.router_service(namespace)
            if service and (service.get("spec") or {}).get("ports"):
                return service
            time.sleep(2)
        return None

    def create_test_namespace(self, name: str) -> bool:
        status, _ = self._api().request(
            "POST",
            "/api/v1/namespaces",
            {"apiVersion": "v1", "kind": "Namespace", "metadata": {"name": name}},
        )
        return status in (200, 201, 409)

    def create_project_gateway(self, namespace: str) -> dict[str, Any] | None:
        name = "kubesphere-router-" + namespace
        status, body = self._api().request(
            "POST",
            self.GATEWAYS.format(namespace=namespace),
            {
                "apiVersion": "gateway.kubesphere.io/v1alpha1",
                "kind": "Gateway",
                "metadata": {"name": name, "namespace": namespace},
                "spec": {
                    "controller": {"replicas": 1, "scope": {"enabled": True, "namespace": namespace}},
                    "deployment": {"replicas": 1},
                    "service": {"type": "NodePort"},
                },
            },
        )
        return body if status in (200, 201) and isinstance(body, dict) else None

    def delete_project_gateway(self, namespace: str, name: str | None = None) -> None:
        """Delete our own gateway; clear the Helm finalizer if deletion stalls."""
        gateway_name = name or "kubesphere-router-" + namespace
        path = f"{self.GATEWAYS.format(namespace=namespace)}/{gateway_name}"
        self._api().request("DELETE", path)
        deadline = time.time() + 20
        while time.time() < deadline:
            current = self.gateway_object(namespace, gateway_name)
            if current is None:
                return
            if current.get("metadata", {}).get("deletionTimestamp"):
                mutable = dict(current)
                mutable["metadata"] = {**current.get("metadata", {}), "finalizers": []}
                self._api().request("PUT", path, mutable)
                self._api().request("DELETE", path)
                return
            time.sleep(2)

    def delete_test_namespace(self, name: str, timeout_seconds: int = 30) -> None:
        self._api().request("DELETE", "/api/v1/namespaces/" + name)
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            status, _ = self._api().request("GET", "/api/v1/namespaces/" + name)
            if status == 404:
                return
            time.sleep(3)
