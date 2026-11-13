"""页面对象：kube-frontend 的集群管理列表（节点、项目）。

这是**集群作用域**的页面：地址是 `/kube-frontend/clusters/<id>/<page>`，没有
workspace 也没有 namespace 段，页面顶部**没有项目工作区栏**。

列表请求的 namespace 为空串，表示集群级集合；这里同样用它去对账。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

#: 集群级集合的 kapis 前缀（namespace 段为空）。
KAPIS_RESOURCES = "/kapis/resources.kubesphere.io/v1alpha3"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class ClusterManagementPage:
    """节点与项目两张集群级列表。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        api: ApiLike | None = None,
    ) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.cluster = cluster
        self.api = api

    def url(self, kind: str = "nodes") -> str:
        # No workspace segment and no project segment: that is what makes this
        # cluster-scoped, and the layout renders no workspace bar because of it.
        return f"{self.base_url}/kube-frontend/clusters/{self.cluster}/{kind}"

    def surface(self, kind: str = "nodes") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:surface"]').last

    def open(self, kind: str = "nodes") -> None:
        url = self.url(kind)
        self.page.goto(url)
        try:
            expect(self.surface(kind)).to_be_visible(timeout=30_000)
        except AssertionError:
            # One reload: the first paint occasionally loses the race with a slow
            # cluster-wide list. Never retried for an error page.
            self.page.goto(url)
            expect(self.surface(kind)).to_be_visible(timeout=60_000)

    def wait_ready(self, kind: str = "nodes", timeout_ms: int = 120_000) -> None:
        """Wait until the list settles.

        Cluster-wide collections are the slowest reads in this environment (31
        namespaces, 3 nodes, and the apiserver also serves everything else), so the
        budget is larger than a namespaced list's.
        """
        expect(self.surface(kind)).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, kind: str = "nodes") -> str | None:
        return self.surface(kind).get_attribute("data-ai-state")

    def headers(self, kind: str = "nodes") -> list[str]:
        return [t.strip() for t in self.surface(kind).locator("thead th:visible").all_inner_texts() if t.strip()]

    def rows(self, kind: str = "nodes") -> Locator:
        return self.surface(kind).locator("[data-ai-row]")

    def row_names(self, kind: str = "nodes") -> list[str]:
        values = self.surface(kind).locator("[data-ai-row]").evaluate_all(
            "els => els.map(e => e.getAttribute('data-ai-row'))"
        )
        return [str(v) for v in values]

    def active_tab(self) -> str | None:
        return self.page.locator('[data-ai-id^="area-tabs:"] a[aria-current="page"]').get_attribute("data-ai-id")

    @property
    def workspace_bar_count(self) -> int:
        """Cluster-scoped pages must render none of these."""
        return self.page.locator('[data-ai-id="workspace-bar"]').count()

    # ---------------- 数据 ----------------

    def list_nodes(self) -> list[dict[str, Any]]:
        assert self.api is not None, "api client required"
        status, body = self.api.request("GET", f"{KAPIS_RESOURCES}/nodes?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("items") or []

    def list_namespaces(self) -> list[dict[str, Any]]:
        assert self.api is not None, "api client required"
        status, body = self.api.request("GET", f"{KAPIS_RESOURCES}/namespaces?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("items") or []
