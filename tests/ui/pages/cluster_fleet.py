"""页面对象：集群列表（`/kube-frontend/clusters`）与集群切换器。

这是**平台作用域**的页面：没有 workspace 段，也没有 cluster 段。列表行与添加/编辑对话框
的句柄都用 `clusters:*` 前缀，切换器的句柄用 `shell:cluster-switcher` 与 `clusters:switch-*`。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

#: 集群对象（写走原生 API 组，读走任一 kapis 端点）。
CLUSTERS_WRITE = "/apis/cluster.kubesphere.io/v1alpha1/clusters"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class ClusterFleetPage:
    def __init__(self, page: Page, base_url: str, api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.api = api

    @property
    def url(self) -> str:
        return f"{self.base_url}/kube-frontend/clusters"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="clusters:surface"]').last

    def open(self) -> None:
        self.page.goto(self.url)
        expect(self.surface).to_be_visible(timeout=30_000)

    def wait_ready(self, timeout_ms: int = 60_000) -> None:
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def row(self, name: str) -> Locator:
        return self.surface.locator(f'[data-ai-row="{name}"]')

    # ---------------- 添加 / 编辑 ----------------

    def open_add(self) -> Locator:
        self.page.locator('[data-ai-id="clusters:add"]').click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        return dialog

    def open_edit(self, name: str) -> Locator:
        """Open 编辑信息 from the row's action menu."""
        self.row(name).locator('button[aria-label="更多操作"]').click()
        self.page.get_by_role("menuitem", name="编辑信息", exact=True).click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        return dialog

    # ---------------- 切换 ----------------

    def open_switcher(self) -> Locator:
        """Open the cluster switcher that sits at the top of a cluster's sidebar."""
        self.page.locator('[data-ai-id="shell:cluster-switcher"]').first.click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        return dialog

    def switcher_current(self) -> str:
        return self.page.locator('[data-ai-id="shell:cluster-switcher"]').first.inner_text()

    def side_nav(self) -> list[str]:
        return [text.strip() for text in self.page.locator("aside a").all_inner_texts() if text.strip()]

    def active_nav(self) -> str | None:
        href = self.page.locator('aside a[aria-current="page"]').first.get_attribute("href")
        return href.rsplit("/", 1)[-1] if href else None
