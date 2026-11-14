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

    def pod_search(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-pods:search"]')

    def pod_refresh(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-pods:refresh"]')

    def workload_surface(self, kind: str) -> Locator:
        return self.surface(f"cluster-{kind}")

    def workload_search(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-{kind}:search"]')

    def workload_refresh(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-{kind}:refresh"]')

    def workload_page_size(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-{kind}:page-size"]')

    def workload_next(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-{kind}:page:next"]')

    def workload_current_page(self, kind: str) -> Locator:
        return self.workload_surface(kind).locator('button[aria-current="page"]')

    def gateway_tab(self, component: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-gateways:tab:{component}"]')

    def kubectl_control(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="kubectl:{name}"]')

    def node_control(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="nodes:{name}"]')

    def node_stat(self, key: str) -> Locator:
        return self.node_control("stats").locator(f'[data-stat-key="{key}"]')

    def node_metric(self, kind: str, name: str) -> Locator:
        return self.node_control(f"metric:{kind}:{name}")

    def node_metric_value(self, kind: str, name: str) -> Locator:
        return self.node_metric(kind, name).locator("span").first

    def node_table(self) -> Locator:
        return self.surface().locator("table")

    def select_node_filter(self, key: str, label: str) -> None:
        self.node_control(f"filter:{key}").click()
        self.page.get_by_role("option", name=label, exact=True).click()

    def select_node_page_size(self, size: int) -> None:
        picker = self.node_control("page-size")
        if picker.evaluate("element => element.tagName") == "SELECT":
            picker.select_option(str(size))
        else:
            picker.click()
            self.page.get_by_role("option", name=str(size), exact=True).click()

    def open_node_action(self, name: str, action: str) -> None:
        row = self.rows().filter(has=self.page.get_by_role("link", name=name, exact=True))
        button = row.get_by_role("button", name="更多操作", exact=True)
        button.scroll_into_view_if_needed()
        button.click()
        self.node_control(action).click()

    def node_mode_control(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="node-mode:{name}"]')

    def node_vendor(self, name: str) -> Locator:
        return self.node_control(f"vendor:{name}")

    def node_mode(self, name: str) -> Locator:
        return self.node_control(f"mode:{name}")

    def node_time(self, name: str) -> Locator:
        return self.node_control(f"ntp:{name}")

    def gpu_control(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-gpus:{name}"]')

    def gpu_detail_control(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="gpu-detail:{name}"]')

    def gpu_rows(self) -> Locator:
        return self.gpu_control("surface").locator("[data-ai-row]")

    def select_gpu_filter(self, name: str, label: str) -> None:
        self.gpu_control(f"filter:{name}").click()
        self.page.get_by_role("option", name=label, exact=True).click()

    def select_gpu_page_size(self, size: int) -> None:
        self.gpu_control("page-size").click()
        self.page.get_by_role("option", name=str(size), exact=True).click()

    def row_names(self, kind: str = "nodes") -> list[str]:
        values = self.surface(kind).locator("[data-ai-row]").evaluate_all(
            "els => els.map(e => e.getAttribute('data-ai-row'))"
        )
        return [str(v) for v in values]

    def active_tab(self) -> str | None:
        """Retained for the project console, which still uses area tabs."""
        return self.page.locator('[data-ai-id^="area-tabs:"] a[aria-current="page"]').get_attribute("data-ai-id")

    # ---------------- 侧栏导航 ----------------

    def nav(self, label: str) -> None:
        """Follow a cluster-level sidebar entry by its visible label.

        The cluster console lists its pages in the left sidebar (old-console interaction);
        the tab strip that used to mirror them was removed so the menu exists once.
        """
        self.page.locator("aside, nav").get_by_role("link", name=label, exact=True).first.click()

    def active_nav(self) -> str | None:
        """The path segment of the highlighted sidebar entry, e.g. `nodes`."""
        href = self.page.locator('aside a[aria-current="page"], nav a[aria-current="page"]').first.get_attribute("href")
        return href.rsplit("/", 1)[-1] if href else None

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
