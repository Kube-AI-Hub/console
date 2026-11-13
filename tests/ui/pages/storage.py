"""页面对象：kube-frontend 的存储列表与详情。

存储卷（PersistentVolumeClaim）与存储卷快照（VolumeSnapshot）共用一套列表与
详情（`StorageListPage` / `StorageDetailPage`），选择器只在这里出现。

存储卷属于核心组，创建走 `/api/v1`；快照属于 `snapshot.storage.k8s.io/v1`。
本页面对象只创建**存储卷**——快照需要 CRD 与驱动支持，目标集群未必具备，用例
遇到空列表时按空态断言即可。
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect

#: Storage classes rarely change during a run, and listing them cluster-wide is one
#: of the slower calls. Cached per process so a suite of ten cases does not pay for
#: it ten times — that cost was pushing the page's own list request past its wait.
_STORAGE_CLASSES: dict[str, str | None] = {}


class ApiLike(Protocol):
    """`conftest.ApiClient` 的最小接口（只声明用到的方法）。"""

    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class StoragePage:
    """存储卷 / 存储卷快照的列表与详情，以及创建、清理测试存储卷的辅助。"""

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

    def url(self, kind: str = "persistentvolumeclaims", namespace: str | None = None) -> str:
        ns = namespace or self.namespace
        return f"{self.base_url}/kube-frontend/{self.workspace}/clusters/{self.cluster}/projects/{ns}/{kind}"

    def detail_url(self, kind: str, name: str, namespace: str | None = None) -> str:
        return f"{self.url(kind, namespace)}/{name}"

    # ---------------- 列表 ----------------

    def surface(self, kind: str = "persistentvolumeclaims") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:surface"]').last

    def open(self, kind: str = "persistentvolumeclaims", namespace: str | None = None) -> None:
        """Open a storage list and wait for its surface.

        One reload retry: on a shared cluster the first paint occasionally loses the
        race with a slow `/kapis` list (or with the session check), and the surface
        then never appears. A reload costs a second and turns that into a pass, while
        a retry loop on the assertion would hide a genuinely broken page — this only
        retries when the page rendered *nothing*, never when it rendered an error.
        """
        url = self.url(kind, namespace)
        self.page.goto(url)
        try:
            expect(self.surface(kind)).to_be_visible(timeout=30_000)
        except AssertionError:
            self.page.goto(url)
            expect(self.surface(kind)).to_be_visible(timeout=60_000)

    def wait_ready(self, kind: str = "persistentvolumeclaims", timeout_ms: int = 60_000) -> None:
        """Wait until the list has settled.

        The timeout is generous because the console is served from a shared cluster:
        a namespaced list that takes 300ms alone can queue behind other requests in a
        full run, and a 5s budget then reports "still loading" for a request that is
        merely in flight.
        """
        expect(self.surface(kind)).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, kind: str = "persistentvolumeclaims") -> str | None:
        return self.surface(kind).get_attribute("data-ai-state")

    def headers(self, kind: str = "persistentvolumeclaims") -> list[str]:
        return [text.strip() for text in self.surface(kind).locator("thead th:visible").all_inner_texts() if text.strip()]

    def rows(self, kind: str = "persistentvolumeclaims") -> Locator:
        return self.surface(kind).locator("[data-ai-row]")

    def row(self, kind: str, name: str) -> Locator:
        return self.surface(kind).locator(f'[data-ai-row="{name}"]')

    def row_text(self, kind: str, name: str) -> str:
        return self.row(kind, name).inner_text()

    def search(self, kind: str, keyword: str) -> None:
        self.page.locator(f'[data-ai-id="{kind}:search"]').last.fill(keyword)
        # The field debounces for 250ms; the request is what matters.
        self.page.wait_for_timeout(400)
        self.wait_ready(kind)

    def ensure_row(self, kind: str, name: str, timeout_ms: int = 5_000) -> None:
        """确保目标行在屏幕上；首页没有时按名称搜索。

        存储列表按创建时间倒序，新建对象通常在首页；但租户里已有几十个卷时，
        首次请求可能在对象创建之前发出——搜索是用户的真实做法，也消除抖动。
        """
        try:
            self.row(kind, name).wait_for(state="visible", timeout=timeout_ms)
            return
        except PlaywrightTimeoutError:
            pass
        self.search(kind, name)
        self.row(kind, name).wait_for(state="visible", timeout=20_000)

    def click_name(self, kind: str, name: str) -> None:
        self.ensure_row(kind, name)
        self.page.locator(f'[data-ai-id="{kind}:open:{name}"]').first.click()

    def open_row_menu(self, kind: str, name: str) -> None:
        self.ensure_row(kind, name)
        self.row(kind, name).locator('button[aria-label="更多操作"]').click()

    def click_row_action(self, action: str) -> None:
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    # ---------------- 详情 ----------------

    def detail_surface(self, kind: str = "persistentvolumeclaims") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}-detail:surface"]').last

    def open_detail(self, kind: str, name: str, namespace: str | None = None) -> None:
        self.page.goto(self.detail_url(kind, name, namespace))
        expect(self.detail_surface(kind)).to_be_visible()
        expect(self.detail_surface(kind)).not_to_have_attribute("data-ai-state", "loading")

    def wait_detail_ready(self, kind: str = "persistentvolumeclaims") -> None:
        """等详情真正渲染出属性。

        `to_be_visible` 只证明外壳在了：详情是独立请求，属性块在数据回来之前是骨架。
        直接读 `dt` 会得到空列表，看起来像「属性没渲染」，实际是读早了一步。
        """
        surface = self.detail_surface(kind)
        expect(surface).not_to_have_attribute("data-ai-state", "loading")
        surface.locator("dt").first.wait_for(state="visible", timeout=20_000)

    def attribute_labels(self, kind: str = "persistentvolumeclaims") -> list[str]:
        return [text.strip() for text in self.detail_surface(kind).locator("dt").all_inner_texts()]

    def attribute_value(self, kind: str, label: str) -> str:
        """按属性名取值：`<dt>` 的下一个兄弟 `<dd>`。"""
        surface = self.detail_surface(kind)
        count = surface.locator("dt").count()
        for index in range(count):
            if surface.locator("dt").nth(index).inner_text().strip() == label:
                return surface.locator("dd").nth(index).inner_text().strip()
        raise AssertionError(f"attribute {label!r} not found")

    # ---------------- 对话框 ----------------

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    @property
    def loading_dialog(self) -> Locator:
        return self.page.locator('[data-ai-id="dialog:loading"]')

    def click(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').first.click()

    # ---------------- 数据准备 ----------------

    def unique(self, prefix: str = "tc-e2e") -> str:
        return f"{prefix}-{int(time.time() * 1000) % 1_000_000}"

    def storage_class(self) -> str | None:
        """一个可动态供应的存储类型；找不到就返回 None（调用方按 Pending 处理）。"""
        assert self.api is not None, "api client required"
        if "default" in _STORAGE_CLASSES:
            return _STORAGE_CLASSES["default"]
        status, body = self.api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/storageclasses?limit=-1")
        if status != 200:
            _STORAGE_CLASSES["default"] = None
            return None
        items = body.get("items") or []
        chosen = None
        for item in items:
            if (item.get("metadata") or {}).get("annotations", {}).get("storageclass.kubernetes.io/is-default-class") == "true":
                chosen = (item.get("metadata") or {}).get("name")
                break
        if chosen is None and items:
            chosen = (items[0].get("metadata") or {}).get("name")
        _STORAGE_CLASSES["default"] = chosen
        return chosen

    def create_pvc(self, name: str, namespace: str | None = None) -> int:
        """创建一个 1Gi 的存储卷。

        `storageClassName` 省略时用集群默认类型；没有默认类型时对象会停在 Pending，
        对列表/详情/编辑/删除用例没有影响，只有断言 `Bound` 的用例才需要真正绑定。
        """
        assert self.api is not None, "api client required"
        ns = namespace or self.namespace
        cls = self.storage_class()
        body: dict[str, Any] = {
            "apiVersion": "v1",
            "kind": "PersistentVolumeClaim",
            "metadata": {"name": name, "namespace": ns},
            "spec": {
                "accessModes": ["ReadWriteOnce"],
                "resources": {"requests": {"storage": "1Gi"}},
                **({"storageClassName": cls} if cls else {}),
            },
        }
        status, _ = self.api.request("POST", f"/api/v1/namespaces/{ns}/persistentvolumeclaims", body)
        return status

    def delete_pvc(self, name: str, namespace: str | None = None, timeout: float = 60) -> None:
        """删除存储卷并等到它真的消失（404）。已删除的对象同样安全。"""
        assert self.api is not None, "api client required"
        ns = namespace or self.namespace
        self.api.request("DELETE", f"/api/v1/namespaces/{ns}/persistentvolumeclaims/{name}")
        deadline = time.time() + timeout
        while time.time() < deadline:
            status, _ = self.api.request("GET", f"/api/v1/namespaces/{ns}/persistentvolumeclaims/{name}")
            if status == 404:
                return
            time.sleep(0.25)

    def first_pvc_with_data(self, namespace: str) -> str | None:
        """某个项目里已存在的存储卷名（只读用例用，避免创建对象）。"""
        assert self.api is not None, "api client required"
        status, body = self.api.request(
            "GET",
            f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{namespace}/persistentvolumeclaims?limit=1",
        )
        items = (body.get("items") or []) if status == 200 else []
        return (items[0].get("metadata") or {}).get("name") if items else None
