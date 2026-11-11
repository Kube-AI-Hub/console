"""页面对象：kube-frontend 的集群配置字典。

与 `configmaps.py` 同一套约定：选择器只出现在这里。集群级与项目级的差别是
URL 形状、跨项目的行句柄，以及创建时必须选项目——所以这里组合现有页面对象而
不是复制它。
"""

from __future__ import annotations

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

    def wait_ready(self) -> None:
        """Wait until the page has left the loading state."""
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading")
        expect(self.surface).to_have_attribute("data-ai-state", "ready|empty")

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
        self.search_box.fill(keyword)
        # The field debounces for 250ms before issuing the request.
        self.page.wait_for_timeout(600)

    @property
    def create_button(self) -> Locator:
        return self.surface.locator('[data-ai-id="cluster-configmaps:create"]')

    @property
    def bulk_delete(self) -> Locator:
        return self.surface.locator('[data-ai-id="cluster-configmaps:bulk-delete"]')

    def row_checkbox(self, project: str, name: str) -> Locator:
        return self.surface.locator(f'input[data-ai-id="cluster-configmaps:select:{project}/{name}"]')

    def open_row_menu(self, project: str, name: str) -> None:
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
