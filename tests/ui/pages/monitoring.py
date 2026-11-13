"""页面对象：kube-frontend 的监控告警列表（告警消息、告警策略）。

两张表共用一套列表组件（`MonitoringListPage`），选择器只在这里出现。

告警数据走的是它自己的 kapis 组（`alerting.kubesphere.io/v1alpha2`），不是通用
资源代理；目标集群可能根本没装告警模块，这时接口返回 **200 且响应体为空**，
页面应显示空态而不是错误面板——用例据此断言。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


#: 告警聚合 API 的 kapis 前缀。
ALERTING_KAPIS = "/kapis/alerting.kubesphere.io/v1alpha2"


class MonitoringPage:
    """告警消息与告警策略的列表。"""

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
        self.api = api

    def url(self, kind: str = "alerts", namespace: str | None = None) -> str:
        ns = namespace or self.namespace
        return f"{self.base_url}/kube-frontend/system-workspace/clusters/{self.cluster}/projects/{ns}/{kind}"

    def surface(self, kind: str = "alerts") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:surface"]').last

    def open(self, kind: str = "alerts", namespace: str | None = None) -> None:
        url = self.url(kind, namespace)
        self.page.goto(url)
        try:
            expect(self.surface(kind)).to_be_visible(timeout=30_000)
        except AssertionError:
            # A single reload: the first paint occasionally loses the race with a slow
            # `/kapis` call on a shared cluster, and a retry loop would hide a genuinely
            # broken page. Only retried when nothing rendered at all.
            self.page.goto(url)
            expect(self.surface(kind)).to_be_visible(timeout=60_000)

    def wait_ready(self, kind: str = "alerts", timeout_ms: int = 60_000) -> None:
        expect(self.surface(kind)).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, kind: str = "alerts") -> str | None:
        return self.surface(kind).get_attribute("data-ai-state")

    def headers(self, kind: str = "alerts") -> list[str]:
        return [text.strip() for text in self.surface(kind).locator("thead th:visible").all_inner_texts() if text.strip()]

    def rows(self, kind: str = "alerts") -> Locator:
        return self.surface(kind).locator("[data-ai-row]")

    def active_tab(self) -> str | None:
        return self.page.locator('[data-ai-id^="area-tabs:"] a[aria-current="page"]').get_attribute("data-ai-id")

    # ---------------- 数据 ----------------

    def has_data(self, kind: str = "alerts") -> bool:
        """该页是否有数据；模块未安装时接口返回 200 空响应体。"""
        assert self.api is not None, "api client required"
        status, body = self.api.request(
            "GET", f"{ALERTING_KAPIS}/namespaces/{self.namespace}/{kind}?limit=1"
        )
        if status != 200 or not isinstance(body, dict):
            return False
        return bool(body.get("items"))
