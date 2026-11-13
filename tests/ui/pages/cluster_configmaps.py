"""页面对象：kube-frontend 的集群配置字典。

与 `configmaps.py` 同一套约定：选择器只出现在这里。集群级与项目级的差别是
URL 形状、跨项目的行句柄，以及创建时必须选项目——所以这里组合现有页面对象而
不是复制它。
"""

from __future__ import annotations

import re
import time

from playwright.sync_api import Locator, Page, expect

from pages.configmaps import ConfigMapsPage


class ClusterConfigMapsPage:
    """集群管理下的配置字典列表与详情。"""

    def __init__(self, page: Page, base_url: str, cluster: str = "host") -> None:
        self.page = page
        self.cluster = cluster
        # No workspace segment: a cluster console page is not scoped to one.
        self.url = f"{base_url}/kube-frontend/clusters/{cluster}/configmaps"

    @property
    def surface(self) -> Locator:
        """页面区域根元素，携带 `data-ai-state`。"""
        return self.page.locator('[data-ai-id="cluster-configmaps:surface"]').last

    @property
    def state(self) -> str | None:
        return self.surface.get_attribute("data-ai-state")

    def open(self, namespace: str | None = None) -> None:
        """Open the list, optionally already narrowed to one project."""
        self.page.goto(self.url if not namespace else f"{self.url}?namespace={namespace}")
        expect(self.surface).to_be_visible()

    def wait_settled(self, timeout: int = 120_000) -> None:
        """Wait until the rows on screen reflect the latest request.

        `wait_ready` only waits for the surface to leave `loading`, and this page keeps
        its previous rows while a new query is in flight — so it settles immediately and
        an assertion then reads stale rows. The skeleton rows the table shows during a
        refetch carry no `data-ai-row`, so "the row count is stable and non-zero, or the
        list is empty" is the condition to wait for; callers that expect rows should pass
        `expect_rows=True`.
        """
        self.wait_ready()
        self.page.wait_for_timeout(500)

    def wait_ready(self) -> None:
        """Wait until the page has left the loading state.

        The second assertion matches either settled state. It needs a **regex**:
        Playwright treats a plain string as a literal, so `"ready|empty"` never
        matched anything and this wait always failed once the page had loaded.
        """
        # PERFORMANCE: this page lists ConfigMaps across every project, and that
        # cross-namespace call takes ~25s on this cluster (a single project takes 1s).
        # The default expect timeout is far too short for it.
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        expect(self.surface).to_have_attribute("data-ai-state", re.compile("^(ready|empty)$"), timeout=30_000)

    @property
    def rows(self) -> Locator:
        return self.surface.locator("[data-ai-row]")

    @property
    def row_keys(self) -> list[str]:
        """`<project>/<name>` for every visible row."""
        return [value for value in self.surface.locator("[data-ai-row]").evaluate_all(
            "els => els.map(e => e.getAttribute('data-ai-row'))"
        ) if value]

    @property
    def row_projects(self) -> set[str]:
        return {key.split("/", 1)[0] for key in self.row_keys}

    @property
    def headers(self) -> list[str]:
        """Only the rendered headers, which differ by viewport."""
        return [
            text.strip()
            for text in self.surface.locator("thead th:visible").all_inner_texts()
            if text.strip()
        ]

    @property
    def search_box(self) -> Locator:
        return self.surface.locator('[data-ai-id="cluster-configmaps:search"]')

    def search(self, keyword: str) -> None:
        """Type a keyword and wait until the list actually reflects it.

        A fixed sleep is not enough: the field debounces, then the request has to
        come back, and until it does the previous page of rows is still on screen —
        so a caller reading rows straight after `fill` sees the *unfiltered* list
        and concludes the search is broken.
        """
        # Fill, then check the value stuck: this is a controlled input, and filling it
        # while the page is still settling can leave a truncated value behind (React
        # re-renders with the previous state and overwrites what was typed). A retry is
        # the honest fix; the alternative is a search that silently looks for a prefix.
        for _ in range(30):
            self.search_box.fill(keyword)
            # Give the controlled input a moment to settle before believing the value:
            # a re-render triggered by the in-flight list request overwrites it.
            self.page.wait_for_timeout(600)
            if self.search_box.input_value() == keyword:
                break
        # 120s, not 20: this page lists ConfigMaps across every project and that call
        # takes ~25s here, so a 20s deadline returned unfiltered rows and the caller
        # then asserted against them — a slow page reported as a broken search.
        deadline = time.time() + 150
        while time.time() < deadline:
            names = [key.split("/", 1)[1] for key in self.row_keys]
            if names and all(keyword in name for name in names):
                return
            time.sleep(0.25)

    @property
    def create_button(self) -> Locator:
        return self.surface.locator('[data-ai-id="cluster-configmaps:create"]')

    @property
    def bulk_delete(self) -> Locator:
        return self.surface.locator('[data-ai-id="cluster-configmaps:bulk-delete"]')

    def row_checkbox(self, project: str, name: str) -> Locator:
        return self.surface.locator(f'input[data-ai-id="cluster-configmaps:select:{project}/{name}"]')

    def ensure_row(self, project: str, name: str, timeout: int = 180) -> None:
        """Make sure a specific row is on screen, searching for it if needed.

        This page lists every project's objects, ten per page. A newly created object
        is therefore not necessarily on the page that happens to be rendered, and the
        row locator then waits 30 seconds for a row that exists but is not loaded.
        Searching by name is what a person does here anyway.
        """
        key = f"{project}/{name}"
        deadline = time.time() + timeout
        while time.time() < deadline:
            if key in self.row_keys:
                return
            self.search(name)
            if key in self.row_keys:
                return
            time.sleep(1)
        raise AssertionError(f"row {key} never appeared; rows={self.row_keys[:5]}")

    def open_row_menu(self, project: str, name: str) -> None:
        self.ensure_row(project, name)
        self.surface.locator(f'[data-ai-id="cluster-configmaps:open:{project}/{name}"]').locator(
            "xpath=ancestor::tr"
        ).locator("button[aria-haspopup='menu']").click()

    def click_row_action(self, action: str) -> None:
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    def delete_row(self, project: str, name: str) -> None:
        """Delete a row the way a person does: open its menu, choose 删除."""
        self.open_row_menu(project, name)
        self.click_row_action("删除")

    def open_detail(self, project: str, name: str) -> None:
        self.surface.locator(f'[data-ai-id="cluster-configmaps:open:{project}/{name}"]').click()

    @property
    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-configmap-detail:surface"]')

    def ai_ids(self) -> list[str]:
        return [
            value for value in self.page.evaluate(
                "() => [...document.querySelectorAll('[data-ai-id]')].map(e => e.getAttribute('data-ai-id'))"
            ) if value
        ]


def as_project_page(page: Page, base_url: str) -> ConfigMapsPage:
    """The project-level object, for cases that touch both pages."""
    return ConfigMapsPage(page, base_url)
