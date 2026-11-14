"""页面对象：kube-frontend 的存储区（存储卷 / 存储卷快照）。

两张表共用一套列表与详情（`StorageListPage` / `StorageDetailPage`），页签由
`areas/registry.ts` 的 `storage` 区域声明，选择器只在这里出现。与保密字典、
应用负载相同，优先用 `data-ai-id`：它是新前端的对外契约，不随文案变化。

对象的前置数据通过 kube API 创建：PVC 在核心组 `/api/v1`，而页面读的是
`/kapis` 的 resources 端点（只注册了 GET）。清理逻辑同样放在这里：写用例的人
只需要 `try/finally` 调一次删除，不留 `tc-e2e-` 残留。

一条容易误判的环境事实：集群里有动态 provisioner 时 PVC 才会 `Bound`；这里的
`openebs-hostpath` 在本环境可能让 PVC 停在 `Pending`。列表、详情、编辑 YAML 与
删除都不依赖绑定状态，所以本页面对象**不**等 `Bound`，也不断言它。
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect

#: 存储区两个页签的路由段，与 `areas/registry.ts` 的 `pages[].key` 一致。
KINDS = ("persistentvolumeclaims", "volumesnapshots")

#: 页签文案；页签高亮断言要用到，和 table 表头一样是用户可见文案。
TAB_LABELS = {"persistentvolumeclaims": "存储卷", "volumesnapshots": "存储卷快照"}


class ApiLike(Protocol):
    """`conftest.ApiClient` 的最小接口。

    只声明本页面对象用到的方法，避免 `pages/` 反向 import `conftest`。
    """

    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class StoragePage:
    """存储区的列表、详情与页签，以及创建/清理 PVC 所需的 API 辅助。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        namespace: str = "default",
        workspace: str = "system-workspace",
        api: ApiLike | None = None,
    ) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.base = f"{self.base_url}/kube-frontend/{workspace}/clusters/{cluster}/projects/{namespace}"
        self.cluster = cluster
        self.namespace = namespace
        self.workspace = workspace
        self.api = api

    # ---------------- URLs ----------------

    def url(self, kind: str = "persistentvolumeclaims") -> str:
        return f"{self.base}/{kind}"

    def for_namespace(self, namespace: str) -> "StoragePage":
        """The same session, pointed at another project.

        Empty-state cases need a project with no claim of the kind; the shared
        `default` project can hold objects from other suites, so the test probes
        candidates through the API and then opens the first empty one.
        """
        return StoragePage(self.page, self.base_url, self.cluster, namespace, self.workspace, self.api)

    def detail_url(self, kind: str, name: str) -> str:
        return f"{self.url(kind)}/{name}"

    # ---------------- List ----------------

    def surface(self, kind: str = "persistentvolumeclaims") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:surface"]').last

    def open(self, kind: str = "persistentvolumeclaims") -> None:
        self.page.goto(self.url(kind))
        try:
            expect(self.surface(kind)).to_be_visible(timeout=15_000)
        except AssertionError:
            # A bounce to /login is a session problem, not a page problem; say so
            # with the evidence a report needs instead of a bare "not found".
            state = self.page.evaluate(
                "() => ({ token: Boolean(localStorage.getItem('kubesphere-token')), keys: Object.keys(localStorage) })"
            )
            raise AssertionError(f"{kind} surface missing at {self.page.url}; storage={state}") from None
        self.wait_ready(self.surface(kind))

    def wait_ready(self, target: str | Locator | None = None, timeout_ms: int = 60_000) -> None:
        """Wait until the list (or a passed detail surface) has settled.

        Accepts either a kind or a surface locator: the list is addressed by kind
        everywhere, while the detail's `data-ai-state` lives on a different surface.
        """
        surface = target if isinstance(target, Locator) else self.surface(target or "persistentvolumeclaims")
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, kind: str = "persistentvolumeclaims") -> str | None:
        return self.surface(kind).get_attribute("data-ai-state")

    def rows(self, kind: str = "persistentvolumeclaims") -> Locator:
        return self.surface(kind).locator("[data-ai-row]")

    def row_names(self, kind: str = "persistentvolumeclaims") -> list[str]:
        return [name for name in self.rows(kind).evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if name]

    def headers(self, kind: str = "persistentvolumeclaims") -> list[str]:
        """Only the headers actually rendered, which differs by viewport."""
        return [text.strip() for text in self.surface(kind).locator("thead th:visible").all_inner_texts() if text.strip()]

    def row(self, kind: str, name: str) -> Locator:
        return self.surface(kind).locator(f'[data-ai-row="{name}"]')

    def row_text(self, kind: str, name: str) -> str:
        return self.row(kind, name).inner_text()

    def name_link(self, kind: str, name: str) -> Locator:
        """The clickable name cell; the detail is reached by clicking it."""
        return self.surface(kind).locator(f'[data-ai-id="{kind}:open:{name}"]')

    def click_name(self, kind: str, name: str) -> None:
        self.ensure_row(kind, name)
        self.name_link(kind, name).click()

    def search(self, kind: str, keyword: str) -> None:
        box = self.page.locator(f'[data-ai-id="{kind}:search"]').last
        box.fill(keyword)
        # The page debounces for 250ms; waiting for the request is what matters.
        self.page.wait_for_timeout(400)
        self.wait_ready(self.surface(kind))

    def ensure_row(self, kind: str, name: str, timeout_ms: int = 4_000) -> None:
        """Make sure `name` is on screen, searching for it if the first page misses it.

        A freshly created object can sit on page 2, or behind the list request that
        started before it existed. Searching by name is how a person finds it too,
        and it removes the "row not found" flake that only appears in full runs.
        """
        try:
            self.row(kind, name).wait_for(state="visible", timeout=timeout_ms)
            return
        except PlaywrightTimeoutError:
            pass
        self.search(kind, name)
        self.row(kind, name).wait_for(state="visible", timeout=15_000)

    def open_row_menu(self, kind: str, name: str) -> None:
        self.ensure_row(kind, name)
        self.row(kind, name).locator('button[aria-label="更多操作"]').click()

    def click_row_action(self, action: str) -> None:
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    # ---------------- Area tabs / workspace ----------------

    @property
    def tabs_nav(self) -> Locator:
        return self.page.locator('[data-ai-id="area-tabs:storage"]')

    def tab(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="area-tabs:{key}"]')

    def active_tab_key(self) -> str | None:
        """Route segment of the tab marked `aria-current="page"`."""
        active = self.tabs_nav.locator('a[aria-current="page"]')
        expect(active).to_have_count(1)
        ai_id = active.get_attribute("data-ai-id") or ""
        return ai_id.rsplit(":", 1)[-1] or None

    def active_tab_label(self) -> str:
        active = self.tabs_nav.locator('a[aria-current="page"]')
        expect(active).to_have_count(1)
        return active.inner_text().strip()

    def switch_tab(self, key: str) -> None:
        """Click an area tab and wait for the client-side route to land."""
        self.tab(key).click()
        self.page.wait_for_url(f"**/projects/{self.namespace}/{key}")
        expect(self.surface(key)).to_be_visible(timeout=15_000)
        expect(self.tab(key)).to_have_attribute("aria-current", "page")

    @property
    def workspace_bar(self) -> Locator:
        return self.page.locator('[data-ai-id="workspace-bar"]')

    @property
    def current_project(self) -> Locator:
        return self.page.locator('[data-ai-id="workspace:current-project"]')

    # ---------------- Detail ----------------

    def detail_surface(self, kind: str = "persistentvolumeclaims") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}-detail:surface"]')

    def open_detail(self, kind: str, name: str) -> None:
        self.page.goto(self.detail_url(kind, name))
        expect(self.detail_surface(kind)).to_be_visible(timeout=15_000)
        self.wait_ready(self.detail_surface(kind))

    def detail_state(self, kind: str = "persistentvolumeclaims") -> str | None:
        return self.detail_surface(kind).get_attribute("data-ai-state")

    def wait_detail_ready(self, kind: str = "persistentvolumeclaims") -> None:
        """Wait for the attributes themselves, not just the detail shell.

        The detail is its own request: its surface becomes visible while a skeleton
        is still on screen, so reading `dt` too early returns an empty list that
        looks exactly like "the attributes did not render".
        """
        surface = self.detail_surface(kind)
        expect(surface).not_to_have_attribute("data-ai-state", "loading")
        surface.locator("dt").first.wait_for(state="visible", timeout=20_000)

    def attribute_labels(self, kind: str = "persistentvolumeclaims") -> list[str]:
        """The `<dt>` labels of the attributes block, in render order."""
        return [text.strip() for text in self.detail_surface(kind).locator("dt").all_inner_texts()]

    def attribute_value(self, kind: str, label: str) -> str:
        """The `<dd>` next to one label; labels themselves carry no handle."""
        term = self.detail_surface(kind).locator("dt", has_text=label).first
        return term.locator("xpath=following-sibling::dd[1]").inner_text().strip()

    @property
    def back_link(self) -> Locator:
        return self.page.locator('[data-ai-id="persistentvolumeclaims-detail:back"]')

    @property
    def detail_edit_yaml_button(self) -> Locator:
        return self.page.locator('[data-ai-id="persistentvolumeclaims-detail:edit-yaml"]')

    # ---------------- Dialogs ----------------

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    @property
    def loading_dialog(self) -> Locator:
        return self.page.locator('[data-ai-id="dialog:loading"]')

    def fill(self, ai_id: str, value: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').fill(value)

    def click(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()

    def wait_dialog_closed(self, timeout: int = 20_000) -> None:
        expect(self.dialog).to_have_count(0, timeout=timeout)

    def cancel_dialog(self) -> None:
        """The footer cancel button, shared by the YAML and delete dialogs."""
        self.dialog.get_by_role("button", name="取消").first.click()

    def wait_editor(self, timeout: int = 20_000) -> None:
        """Wait out the loading dialog: the editor replaces it once the object arrives."""
        expect(self.dialog.locator(".cm-content").first).to_be_visible(timeout=timeout)

    def yaml_editor_text(self) -> str:
        """The CodeMirror document currently rendered in the dialog."""
        editor = self.dialog.locator(".cm-content").first
        expect(editor).to_be_visible()
        return editor.inner_text()

    # ---------------- API helpers ----------------

    def unique(self, suffix: str = "") -> str:
        name = f"tc-e2e-{int(time.time() * 1000) % 1_000_000}"
        return f"{name}-{suffix}" if suffix else name

    def _api(self) -> ApiLike:
        if self.api is None:
            raise RuntimeError("StoragePage was created without an ApiClient")
        return self.api

    def _request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]:
        return self._api().request(method, path, body)

    def _kube_path(self, kind: str, name: str | None = None, namespace: str | None = None) -> str:
        """Write path for one kind, honouring the API group.

        `/api/v1` only serves the core group; PVCs live there, snapshots are a
        `snapshot.storage.k8s.io` CRD and never appear under `/api/v1`.
        """
        if kind == "volumesnapshots":
            prefix = "/apis/snapshot.storage.k8s.io/v1"
        else:
            prefix = "/api/v1"
        ns = namespace or self.namespace
        base = f"{prefix}/namespaces/{ns}/{kind}"
        return f"{base}/{name}" if name else base

    def storage_classes(self) -> list[dict[str, Any]]:
        """Cluster storage classes, as the console's own read path reports them."""
        status, body = self._request("GET", "/kapis/resources.kubesphere.io/v1alpha3/storageclasses?limit=-1")
        if status != 200:
            raise AssertionError(f"could not list storage classes: {status} {body}")
        return body.get("items") or []

    def writable_storage_class(self) -> str | None:
        """A class that can actually provision, preferring the cluster default.

        A `kubernetes.io/no-provisioner` class would leave the claim `Pending`
        forever and is only useful with pre-created PVs, so it is the last resort
        rather than the first.
        """
        classes = self.storage_classes()

        def name_of(item: dict[str, Any]) -> str:
            return str(((item.get("metadata") or {}).get("name")) or "")

        def is_default(item: dict[str, Any]) -> bool:
            annotations = (item.get("metadata") or {}).get("annotations") or {}
            return str(annotations.get("storageclass.kubernetes.io/is-default-class")) == "true"

        def provisions(item: dict[str, Any]) -> bool:
            provisioner = str(item.get("provisioner") or "")
            return bool(provisioner) and provisioner != "kubernetes.io/no-provisioner"

        for predicate in (
            lambda item: is_default(item) and provisions(item),
            lambda item: name_of(item) == "openebs-hostpath" and provisions(item),
            provisions,
        ):
            for item in classes:
                if predicate(item):
                    return name_of(item) or None
        return None

    def create_pvc(
        self,
        name: str,
        namespace: str | None = None,
        *,
        storage_class: str | None = None,
        size: str = "1Gi",
        access_modes: list[str] | None = None,
    ) -> int:
        """Create a PVC in the page's project and return the API status.

        `storageClassName` is filled from a class that exists on this cluster: a
        body naming a class the cluster does not have is rejected, while omitting
        the field silently depends on a default class being marked. Neither is a
        property of the page under test. A claim may stay `Pending` when no
        provisioner is available; only cases that assert `Bound` need a real one.
        """
        ns = namespace or self.namespace
        chosen = storage_class or self.writable_storage_class()
        spec: dict[str, Any] = {
            "accessModes": access_modes or ["ReadWriteOnce"],
            "resources": {"requests": {"storage": size}},
        }
        if chosen:
            spec["storageClassName"] = chosen
        body = {
            "apiVersion": "v1",
            "kind": "PersistentVolumeClaim",
            "metadata": {"name": name, "namespace": ns},
            "spec": spec,
        }
        status, payload = self._request("POST", self._kube_path("persistentvolumeclaims", namespace=ns), body)
        if status not in (200, 201):
            raise AssertionError(f"could not create pvc {name}: {status} {payload}")
        return status

    def get_pvc(self, name: str, namespace: str | None = None) -> tuple[int, dict[str, Any]]:
        return self._request("GET", self._kube_path("persistentvolumeclaims", name, namespace))

    def delete_pvc(self, name: str, namespace: str | None = None, timeout: float = 120) -> None:
        """Delete a PVC and wait until it is gone.

        Safe on an already-deleted object: a 404 is the expected answer when the
        UI performed the delete in the case under test.
        """
        ns = namespace or self.namespace
        status, _ = self._request("DELETE", self._kube_path("persistentvolumeclaims", name, ns))
        if status not in (200, 202, 404):
            raise AssertionError(f"could not delete pvc {name}: {status}")
        self._wait_gone("persistentvolumeclaims", name, timeout, ns)

    def _wait_gone(self, kind: str, name: str, timeout: float, namespace: str | None = None) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            status, _ = self._request("GET", self._kube_path(kind, name, namespace))
            if status == 404:
                return
            time.sleep(0.25)
        raise AssertionError(f"{kind}/{name} still exists {timeout}s after delete")

    def api_total(self, kind: str = "persistentvolumeclaims") -> int:
        """How many objects the page's own read path reports for this project.

        Used to decide whether an empty-state precondition holds before asserting
        it: a project that has grown a claim is not a product defect.
        """
        status, body = self._request(
            "GET", f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{self.namespace}/{kind}?limit=1"
        )
        if status != 200:
            raise AssertionError(f"could not list {kind}: {status} {body}")
        return int(body.get("totalItems") or len(body.get("items") or []))
