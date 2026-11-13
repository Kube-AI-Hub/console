"""页面对象：工作台（`/kube-frontend/`）——读者的企业空间与其中的项目。

工作台是**入口**：它把「企业空间 → 项目（属于某个集群）」这条关系摆出来，点项目进入项目控制台。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class WorkbenchPage:
    def __init__(self, page: Page, base_url: str, api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.api = api

    @property
    def url(self) -> str:
        # Every route lives under the prefix; the bare `/` only redirects here.
        return f"{self.base_url}/kube-frontend/"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="workbench:surface"]').last

    def open(self) -> None:
        self.page.goto(self.url)
        expect(self.surface).to_be_visible(timeout=30_000)

    def wait_ready(self, timeout_ms: int = 120_000) -> None:
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def workspace_sections(self) -> list[str]:
        return [
            value
            for value in self.page.locator('[data-ai-id^="workbench:workspace:"]').evaluate_all(
                "els => els.map(e => e.getAttribute('data-ai-id'))"
            )
            if value
        ]

    def project_links(self) -> list[str]:
        return [
            value
            for value in self.page.locator('[data-ai-id^="workbench:project:"]').evaluate_all(
                "els => els.map(e => e.getAttribute('data-ai-id'))"
            )
            if value
        ]

    def open_project(self, cluster: str, name: str) -> None:
        self.page.locator(f'[data-ai-id="workbench:project:{cluster}/{name}"]').click()
        expect(self.page.locator('[data-ai-id="workspace-bar"]')).to_be_visible(timeout=30_000)
