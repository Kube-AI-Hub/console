"""页面对象：kube-frontend 的平台设置（平台信息、通知渠道）。

平台级页面：`/kube-frontend/settings/<page>`，没有集群、项目段，也不出现项目工作区栏。

通知渠道只报「是否配置」，判定依据是 `kubesphere-monitoring-system` 中 `<channel>s`
命名的 Secret 是否存在；凭据内容从不读取。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

CHANNELS = ["mail", "dingtalk", "wecom", "slack", "webhook"]
SECRETS = "/api/v1/namespaces/kubesphere-monitoring-system/secrets"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class PlatformSettingsPage:
    def __init__(self, page: Page, base_url: str, api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.api = api

    def url(self, view: str = "info") -> str:
        return f"{self.base_url}/kube-frontend/settings/{view}"

    def surface(self, view: str = "info") -> Locator:
        return self.page.locator(f'[data-ai-id="platform-settings:{view}:surface"]').last

    def open(self, view: str = "info") -> None:
        url = self.url(view)
        self.page.goto(url)
        try:
            expect(self.surface(view)).to_be_visible(timeout=30_000)
        except AssertionError:
            self.page.goto(url)
            expect(self.surface(view)).to_be_visible(timeout=60_000)

    def wait_ready(self, view: str = "info", timeout_ms: int = 60_000) -> None:
        expect(self.surface(view)).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, view: str = "info") -> str | None:
        return self.surface(view).get_attribute("data-ai-state")

    def info_labels(self) -> list[str]:
        return [t.strip() for t in self.page.locator('[data-ai-id="platform-settings:info"] dt').all_inner_texts()]

    def channel_rows(self) -> list[tuple[str, str]]:
        """`(channel key, badge text)` for each configured channel row."""
        rows = self.page.locator('[data-ai-id="platform-settings:channels"] [data-ai-row]')
        out: list[tuple[str, str]] = []
        for index in range(rows.count()):
            row = rows.nth(index)
            out.append((row.get_attribute("data-ai-row") or "", row.inner_text().strip()))
        return out

    def active_tab(self) -> str | None:
        return self.page.locator('[data-ai-id^="area-tabs:"] a[aria-current="page"]').get_attribute("data-ai-id")

    @property
    def workspace_bar_count(self) -> int:
        return self.page.locator('[data-ai-id="workspace-bar"]').count()

    def configured_channels(self) -> list[str]:
        """The `<channel>s` Secrets that exist, probed by name.

        Probing by name (not listing the namespace) matches what the page does and is
        the difference between a sub-second check and a 70-second one on this cluster.
        """
        assert self.api is not None, "api client required"
        found: list[str] = []
        for channel in CHANNELS:
            status, _ = self.api.request("GET", f"{SECRETS}/{channel}s")
            if status == 200:
                found.append(f"{channel}s")
        return found
