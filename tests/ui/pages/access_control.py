"""页面对象：kube-frontend 的访问控制（用户、平台角色、企业空间）。

平台级页面：地址形如 `/kube-frontend/access/<page>`，没有集群、项目与企业空间段，
页面顶部**没有项目工作区栏**。

数据来源按资源区分：用户与平台角色在 IAM 组，企业空间在 resources 代理——写错
来源的报错很不直观（一个 404，一个 "resource is not supported"），所以这里显式
按 kind 选择。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

IAM = "/kapis/iam.kubesphere.io/v1alpha2"
RESOURCES = "/kapis/resources.kubesphere.io/v1alpha3"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class AccessControlPage:
    """平台级三张只读表。"""

    def __init__(self, page: Page, base_url: str, api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.api = api

    def url(self, kind: str = "users") -> str:
        return f"{self.base_url}/kube-frontend/access/{kind}"

    def surface(self, kind: str = "users") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:surface"]').last

    def open(self, kind: str = "users") -> None:
        url = self.url(kind)
        self.page.goto(url)
        try:
            expect(self.surface(kind)).to_be_visible(timeout=30_000)
        except AssertionError:
            self.page.goto(url)
            expect(self.surface(kind)).to_be_visible(timeout=60_000)

    def open_landing(self) -> None:
        """Open the access area root. The app must land on the users list."""
        url = f"{self.base_url}/kube-frontend/access"
        self.page.goto(url)
        try:
            expect(self.surface("users")).to_be_visible(timeout=30_000)
        except AssertionError:
            self.page.goto(url)
            expect(self.surface("users")).to_be_visible(timeout=60_000)

    def wait_ready(self, kind: str = "users", timeout_ms: int = 180_000) -> None:
        """Platform lists are the slowest reads here (thousands of users)."""
        expect(self.surface(kind)).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, kind: str = "users") -> str | None:
        return self.surface(kind).get_attribute("data-ai-state")

    def headers(self, kind: str = "users") -> list[str]:
        return [t.strip() for t in self.surface(kind).locator("thead th:visible").all_inner_texts() if t.strip()]

    def row_names(self, kind: str = "users") -> list[str]:
        values = self.surface(kind).locator("[data-ai-row]").evaluate_all(
            "els => els.map(e => e.getAttribute('data-ai-row'))"
        )
        return [str(v) for v in values]

    def active_tab(self) -> str | None:
        return self.page.locator('[data-ai-id^="area-tabs:"] a[aria-current="page"]').get_attribute("data-ai-id")

    def workspace_member_row(self, username: str) -> Locator:
        return self.page.locator(f'[data-ai-id="workspace-members:surface"] [data-ai-row="{username}"]')

    def workspace_member_field(self, key: str) -> Locator:
        return self.page.get_by_role("dialog").locator(f"#ai-field-{key}")

    def workspace_member_submit(self) -> Locator:
        return self.page.get_by_role("dialog").get_by_role("button", name="确认", exact=True)

    def workspace_member_invite(self) -> Locator:
        return self.page.locator('[data-ai-id="workspace-members:invite"]')

    def workspace_member_action(self, username: str, action: str) -> None:
        self.workspace_member_row(username).get_by_role("button", name="更多操作").click()
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    def workspace_member_confirmation(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="workspace-members:delete-{kind}"]')

    def user_groups_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="workspace-user-groups:surface"]').last

    def user_groups_open(self, workspace: str) -> None:
        origin = self.base_url.split("/kube-frontend/")[0]
        self.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/user-groups")
        expect(self.user_groups_surface()).to_be_visible(timeout=30_000)
        expect(self.user_groups_surface()).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    def user_groups_create(self) -> Locator:
        return self.page.locator('[data-ai-id="workspace-user-groups:create"]')

    def user_groups_node(self, generate_name: str) -> Locator:
        return self.page.locator(f'[data-ai-generate-name="{generate_name}"]')

    def user_groups_field(self, key: str) -> Locator:
        return self.page.get_by_role("dialog").locator(f"#ai-field-{key}")

    def user_groups_submit(self) -> Locator:
        return self.page.get_by_role("dialog").get_by_role("button", name="确认", exact=True)

    def user_groups_confirmation(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="workspace-user-groups:delete-{kind}"]')

    @property
    def workspace_bar_count(self) -> int:
        return self.page.locator('[data-ai-id="workspace-bar"]').count()

    # ---------------- 数据 ----------------

    def has_data(self, kind: str) -> bool:
        status, body = self._request(kind, "?limit=1")
        return status == 200 and isinstance(body, dict) and bool(body.get("items"))

    def _request(self, kind: str, query: str = "", name: str = "") -> tuple[int, dict[str, Any]]:
        assert self.api is not None, "api client required"
        if kind in ("users", "clusterroles"):
            path = f"{IAM}/{kind}"
        else:
            path = f"{RESOURCES}/{kind}"
        if name:
            path = f"{path}/{name}"
        return self.api.request("GET", path + (query if not name else ""))
