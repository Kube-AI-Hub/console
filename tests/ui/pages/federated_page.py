"""页面对象：企业空间的联邦项目列表、详情与联邦资源详情。

选择器只在这里出现，规格与用例不写 CSS。优先用 `data-ai-id`：它是新前端的对外契约，
不随文案变化。

写用例统一使用唯一前缀（`pwfed` + 运行后缀）创建宿主命名空间与 FederatedNamespace，
并在 `finally` 里删除命名空间（级联删除联邦对象）。命名空间删除受 finalizer 影响，
清理后轮询到 404 才算完成；删除失败也保留证据，不用「删掉了」掩盖。

2026-11-15 实测的写入契约（详见 design 的 DEC-10 与 DEC-14）：
宿主命名空间必须带 `kubefed.io/managed=true`，否则控制面的 Propagation 恒为 False；
项目通过删除宿主命名空间删除，FederatedNamespace 由其级联删除。
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

FEDERATED = "/apis/types.kubefed.io/v1beta1"
NAMESPACES = FEDERATED + "/federatednamespaces"
TENANT_NAMESPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces/{workspace}/namespaces"
CORE_NAMESPACES = "/api/v1/namespaces"
CLUSTERS = "/kapis/cluster.kubesphere.io/v1alpha1/clusters"
WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1"

#: The workspace label the control plane propagates.
WORKSPACE_LABEL = "kubesphere.io/workspace"


class ApiLike(Protocol):
    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        content_type: str = "application/json",
    ) -> tuple[int, dict[str, Any]]: ...


def workspace_of(item: dict[str, Any]) -> str:
    """The owning workspace: template label first, then the object's own label."""
    template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
    labels = (item.get("metadata") or {}).get("labels") or {}
    return template.get(WORKSPACE_LABEL) or labels.get(WORKSPACE_LABEL) or ""


def wait_until(predicate, timeout: float = 60.0, interval: float = 1.0):
    """Poll `predicate` until it returns a truthy value, then return it."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(interval)
    return predicate()


class FederatedProjectsPageObject:
    """列表、详情、联邦资源详情与写入辅助。"""

    def __init__(self, page: Page, base_url: str, api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.api = api

    # ---------------- URLs ----------------

    def list_url(self, workspace: str) -> str:
        return f"{self.base_url}/kube-frontend/workspaces/{workspace}/federatedprojects"

    def detail_url(self, workspace: str, name: str) -> str:
        return f"{self.list_url(workspace)}/{name}"

    def resource_url(self, workspace: str, project: str, segment: str, name: str) -> str:
        return f"{self.detail_url(workspace, project)}/{segment}/{name}"

    # ---------------- List ----------------

    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="federated-projects:surface"]').last

    def open_list(self, workspace: str) -> None:
        self.page.goto(self.list_url(workspace))
        expect(self.surface()).to_be_visible(timeout=30_000)
        expect(self.surface()).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    def wait_ready(self) -> None:
        expect(self.surface()).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    def rows(self) -> Locator:
        return self.surface().locator("tbody tr[data-ai-row]")

    def row(self, name: str) -> Locator:
        return self.surface().locator(f'tbody tr[data-ai-row="{name}"]')

    def open_link(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="federated-projects:open:{name}"]').first

    def search(self, keyword: str) -> None:
        box = self.page.locator('[data-ai-id="federated-projects:search"]').first
        box.fill(keyword)
        # The page debounces the search by 250ms.
        self.page.wait_for_timeout(500)

    def create_button(self) -> Locator:
        return self.page.locator('[data-ai-id="federated-projects:create"]').first

    def open_row_action(self, name: str, action_ai_id: str) -> None:
        """Open one row's more-actions menu and choose an item by its handle."""
        row = self.row(name)
        row.get_by_role("button", name="更多操作").click()
        self.page.locator(f'[data-ai-id="{action_ai_id}"]').last.click()

    # ---------------- Create dialog ----------------

    def create_dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    def open_create(self) -> None:
        self.create_button().click()
        expect(self.create_dialog()).to_be_visible(timeout=20_000)

    def fill_create(self, *, name: str, alias: str = "", description: str = "", cluster_labels: list[str] | None = None) -> None:
        dialog = self.create_dialog()
        dialog.locator('[data-ai-id="federated-projects:create-name"]').fill(name)
        if alias:
            dialog.locator('[data-ai-id="federated-projects:create-alias"]').fill(alias)
        if description:
            dialog.locator('[data-ai-id="federated-projects:create-description"]').fill(description)
        if cluster_labels is not None:
            trigger = dialog.locator('[data-ai-id="federated-projects:create-clusters"]')
            trigger.click()
            # Clear the default selection through the picker's own control.
            clear = self.page.get_by_role("button", name="清空已选集群").last
            if clear.is_visible():
                clear.click()
            for label in cluster_labels:
                self.page.get_by_role("checkbox", name=label).last.click()
            # Close the popover before pressing submit.
            self.page.keyboard.press("Escape")

    def submit_create(self) -> None:
        self.create_dialog().locator('[data-ai-id="federated-projects:create-submit"]').click()

    def create_error(self) -> Locator:
        return self.create_dialog().locator("[role=alert]")

    # ---------------- Edit / placement / delete dialogs ----------------

    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="federated-project:surface"]').last

    def open_detail(self, workspace: str, name: str) -> None:
        self.page.goto(self.detail_url(workspace, name))
        expect(self.detail_surface()).to_be_visible(timeout=30_000)
        expect(self.detail_surface()).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    def detail_tab(self, tab: str) -> Locator:
        return self.page.locator(f'[data-ai-id="federated-project:tab:{tab}:trigger"]').first

    def open_edit_info(self) -> None:
        self.page.locator('[data-ai-id="federated-project:edit-info"]').first.click()
        expect(self.create_dialog()).to_be_visible(timeout=20_000)

    def save_edit_info(self, *, alias: str, description: str) -> None:
        dialog = self.create_dialog()
        dialog.locator('[data-ai-id="federated-project:edit-alias"]').fill(alias)
        dialog.locator('[data-ai-id="federated-project:edit-description"]').fill(description)
        dialog.locator('[data-ai-id="federated-project:edit-info-submit"]').first.click()

    def open_placement(self) -> None:
        self.page.locator('[data-ai-id="federated-project:edit-placement"]').first.click()
        expect(self.create_dialog()).to_be_visible(timeout=20_000)

    def submit_placement(self) -> None:
        self.create_dialog().locator('[data-ai-id="federated-projects:placement-submit"]').click()

    def open_delete_from_detail(self) -> None:
        self.page.locator('[data-ai-id="federated-project:delete"]').first.click()
        expect(self.create_dialog()).to_be_visible(timeout=20_000)

    def confirm_delete(self, expected_text: str) -> None:
        dialog = self.create_dialog()
        dialog.locator('[data-ai-id$=":delete-input"]').fill(expected_text)
        dialog.locator('[data-ai-id$=":delete-confirm"]').click()

    def list_delete(self, names: list[str]) -> None:
        """Open the bulk delete dialog from a selection and confirm the count."""
        self.page.locator('[data-ai-id="federated-projects:bulk-delete"]').first.click()
        expect(self.create_dialog()).to_be_visible(timeout=20_000)
        self.confirm_delete(str(len(names)))

    # ---------------- Resource detail ----------------

    def resource_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="federated-resource:surface"]').last

    def open_resource(self, workspace: str, project: str, segment: str, name: str) -> None:
        self.page.goto(self.resource_url(workspace, project, segment, name))
        expect(self.resource_surface()).to_be_visible(timeout=30_000)
        expect(self.resource_surface()).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    # ---------------- API helpers (setup / assertions / cleanup) ----------------

    def project_names(self) -> list[dict[str, Any]]:
        assert self.api is not None, "API client is required for federated project setup"
        status, body = self.api.request("GET", NAMESPACES)
        assert status == 200, (status, body)
        return list(body.get("items") or [])

    def find_project(self, name: str) -> dict[str, Any] | None:
        for item in self.project_names():
            if (item.get("metadata") or {}).get("name") == name:
                return item
        return None

    def create_project(
        self,
        *,
        workspace: str,
        name: str,
        alias: str = "",
        description: str = "",
        clusters: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a federated project the way the page does (two writes)."""
        assert self.api is not None
        clusters = clusters or ["host"]
        annotations = {"kubesphere.io/creator": "admin"}
        if alias:
            annotations["kubesphere.io/alias-name"] = alias
        if description:
            annotations["kubesphere.io/description"] = description
        status, body = self.api.request(
            "POST",
            TENANT_NAMESPACES.format(workspace=workspace),
            {
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {
                    "name": name,
                    "labels": {WORKSPACE_LABEL: workspace, "kubefed.io/managed": "true"},
                },
            },
        )
        assert status in (200, 201), (status, body)
        federated = {
            "apiVersion": "types.kubefed.io/v1beta1",
            "kind": "FederatedNamespace",
            "metadata": {
                "name": name,
                "namespace": name,
                "labels": {WORKSPACE_LABEL: workspace},
                "annotations": annotations,
            },
            "spec": {
                "placement": {"clusters": [{"name": cluster} for cluster in clusters]},
                "template": {"metadata": {"labels": {WORKSPACE_LABEL: workspace}}},
                "overrides": [
                    {"clusterName": cluster, "clusterOverrides": [{"path": "/metadata/annotations", "value": annotations}]}
                    for cluster in clusters
                ],
            },
        }
        status, body = self.api.request("POST", f"{FEDERATED}/namespaces/{name}/federatednamespaces", federated)
        assert status in (200, 201), (status, body)
        created = wait_until(lambda: self.find_project(name), timeout=30)
        assert created, f"federated project {name} was created but not listed"
        return created

    def delete_project(self, name: str) -> None:
        assert self.api is not None
        self.api.request("DELETE", f"{CORE_NAMESPACES}/{name}")
        wait_until(
            lambda: self.api.request("GET", f"{CORE_NAMESPACES}/{name}")[0] == 404,
            timeout=90,
            interval=2.0,
        )

    def create_federated_configmap(self, *, namespace: str, name: str, data: dict[str, str]) -> dict[str, Any]:
        assert self.api is not None
        status, body = self.api.request(
            "POST",
            f"{FEDERATED}/namespaces/{namespace}/federatedconfigmaps",
            {
                "apiVersion": "types.kubefed.io/v1beta1",
                "kind": "FederatedConfigMap",
                "metadata": {"name": name, "namespace": namespace},
                "spec": {
                    "placement": {"clusterSelector": {}},
                    "template": {"metadata": {"name": name, "namespace": namespace}, "data": data},
                },
            },
        )
        assert status in (200, 201), (status, body)
        return body

    def delete_federated_configmap(self, *, namespace: str, name: str) -> None:
        assert self.api is not None
        self.api.request("DELETE", f"{FEDERATED}/namespaces/{namespace}/federatedconfigmaps/{name}")
        wait_until(
            lambda: self.api.request("GET", f"{FEDERATED}/namespaces/{namespace}/federatedconfigmaps/{name}")[0] == 404,
            timeout=60,
        )

    def clusters(self) -> list[dict[str, Any]]:
        assert self.api is not None
        status, body = self.api.request("GET", CLUSTERS)
        assert status == 200, (status, body)
        return list(body.get("items") or [])

    def workspaces(self) -> list[str]:
        assert self.api is not None
        status, body = self.api.request("GET", WORKSPACES)
        assert status == 200, (status, body)
        return [(item.get("metadata") or {}).get("name") or "" for item in (body.get("items") or [])]
