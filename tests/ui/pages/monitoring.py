"""页面对象：kube-frontend 的监控告警（告警消息、告警策略、策略详情）。

两张列表共用一套列表组件（`MonitoringListPage`），策略详情是独立路由
（`RuleGroupDetailPage`）。选择器只在这里出现。

数据来源（2026-11-15 探测，不是照抄旧版本）：
- 告警消息读聚合 API `/kapis/alerting.kubesphere.io/v2beta1/...`：
  项目级 `namespaces/<ns>/alerts`、集群级 `clusteralerts`、内置 `globalalerts`。
  这些端点返回 `{items, totalItems}`；旧的 `/kapis/alerting.kubesphere.io/v1alpha2/...`
  在本部署返回 200 空体，读它会让「有告警」显示成「没有告警」。
- 告警策略读 CRD 组 `/apis/alerting.kubesphere.io/v2beta1/...`。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


#: 聚合告警 API 的 kapis 前缀（项目/集群/内置三个集合都在它下面）。
ALERTING_KAPIS = "/kapis/alerting.kubesphere.io/v2beta1"

#: 规则组 CRD 的 /apis 前缀；写与单对象读取都走这里。
RULE_GROUPS_API = "/apis/alerting.kubesphere.io/v2beta1"


class MonitoringPage:
    """告警消息、告警策略列表，以及策略详情。"""

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

    def detail_url(self, name: str, scope: str = "project", namespace: str | None = None) -> str:
        """策略详情 URL；`scope` 选择 global/cluster/project 三个集合之一。"""
        ns = namespace or self.namespace
        return f"{self.url('alertingrules', ns)}/{name}?scope={scope}"

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

    def open_detail(self, name: str, scope: str = "project", namespace: str | None = None) -> None:
        self.page.goto(self.detail_url(name, scope, namespace))
        expect(self.detail_surface()).to_be_visible(timeout=30_000)
        self.wait_detail_ready()

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

    # ---------------- 策略详情 ----------------

    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="alertingrules:detail"]').last

    def detail_state(self) -> str | None:
        return self.detail_surface().get_attribute("data-ai-state")

    def wait_detail_ready(self, timeout_ms: int = 60_000) -> None:
        expect(self.detail_surface()).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def detail_attributes(self) -> str:
        return self.page.locator('[data-ai-id="alertingrules:detail:attributes"]').inner_text()

    def detail_rule_table(self) -> Locator:
        return self.page.locator('[data-ai-id="alertingrules:detail:rule-table"]')

    def detail_rule_rows(self) -> Locator:
        return self.detail_rule_table().locator("tbody tr")

    def messages_section(self) -> Locator:
        return self.page.locator('[data-ai-id="alertingrules:detail:messages"]')

    def messages_state(self) -> str | None:
        return self.messages_section().get_attribute("data-ai-state")

    def message_rows(self) -> Locator:
        return self.messages_section().locator("[data-ai-row]")

    def open_row_menu(self, name: str, kind: str = "alertingrules") -> None:
        row = self.surface(kind).locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()

    # ---------------- 数据 ----------------

    def has_data(self, kind: str = "alerts") -> bool:
        """该页是否有数据：告警读聚合集合，策略读规则组 CRD 组。"""
        assert self.api is not None, "api client required"
        if kind == "alerts":
            path = f"{ALERTING_KAPIS}/namespaces/{self.namespace}/alerts?limit=1"
        else:
            path = f"{RULE_GROUPS_API}/namespaces/{self.namespace}/rulegroups?limit=1"
        status, body = self.api.request("GET", path)
        if status != 200 or not isinstance(body, dict):
            return False
        return bool(body.get("items"))
