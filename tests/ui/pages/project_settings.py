"""页面对象：kube-frontend 的项目设置（项目角色、项目成员）。

两张表共用一套列表组件（`SettingsListPage`），选择器只在这里出现。

IAM 数据走 `iam.kubesphere.io/v1alpha2`，不是通用资源代理；角色的权限明细只在
详情请求里返回，所以规则表用例必须单独取一次角色对象来对账。
"""

from __future__ import annotations

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
