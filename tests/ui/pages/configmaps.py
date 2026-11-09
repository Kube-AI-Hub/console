"""页面对象：kube-frontend 的配置字典列表。

选择器只出现在这里。用例按动作命名调用，不直接写 CSS，这样改版时只改一个文件。

选择器优先用 `data-ai-id`：它是新前端的对外契约（见 design/kube-frontend），
不随文案变化，也不依赖 DOM 层级。
"""

from __future__ import annotations

from playwright.sync_api import Locator, Page, expect


class ConfigMapsPage:
    """配置字典列表与详情。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        namespace: str = "default",
        workspace: str = "system-workspace",
    ) -> None:
        self.page = page
        # Mirrors the old console project path, prefixed so both apps can serve
        # the same host without colliding.
        self.url = (
            f"{base_url}/kube-frontend/{workspace}/clusters/{cluster}/projects/{namespace}/configmaps"
        )

    @property
    def surface(self) -> Locator:
        """页面区域根元素，携带 `data-ai-state`。"""
        return self.page.locator('[data-ai-id="configmaps:surface"]').last

    def open(self) -> None:
        self.page.goto(self.url)
        expect(self.surface).to_be_visible()

    def wait_ready(self) -> None:
        """等到页面离开加载态。

        智能体做同样的判断；这里用同一个属性而不是等待固定时长。
        """
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading")

    @property
    def state(self) -> str | None:
        return self.surface.get_attribute("data-ai-state")

    @property
    def rows(self) -> Locator:
        return self.surface.locator("[data-ai-row]")

    def row_names(self) -> list[str]:
        return [value for value in self.rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if value]

    @property
    def headers(self) -> list[str]:
        return [text.strip() for text in self.surface.locator("thead th").all_inner_texts() if text.strip()]

    @property
    def search_box(self) -> Locator:
        return self.surface.locator('[data-ai-id="configmaps:search"]')

    def search(self, keyword: str) -> None:
        self.search_box.fill(keyword)
        # The page debounces for 250ms; waiting for the request is what matters.
        self.page.wait_for_timeout(400)
        self.wait_ready()

    def sort_by(self, key: str) -> None:
        self.surface.locator(f'[data-ai-id="configmaps:sort:{key}"]').click()
        self.wait_ready()

    @property
    def bulk_delete(self) -> Locator:
        return self.surface.locator('[data-ai-id="configmaps:bulk-delete"]')

    def select_row(self, name: str) -> None:
        self.surface.locator(f'[data-ai-id="configmaps:select:{name}"] input[type="checkbox"]').check()

    def delete_row(self, name: str) -> None:
        self.surface.locator(f'[data-ai-id="configmaps:delete:{name}"]').click()

    @property
    def retry_button(self) -> Locator:
        return self.surface.locator('[data-ai-id="configmaps:retry"]')

    def ai_ids(self) -> list[str]:
        return [
            value
            for value in self.page.evaluate(
                "() => [...document.querySelectorAll('[data-ai-id]')].map(el => el.getAttribute('data-ai-id'))"
            )
            if value
        ]


class AppShell:
    """应用壳：宽屏侧栏，窄屏抽屉。"""

    def __init__(self, page: Page) -> None:
        self.page = page

    @property
    def sidebar(self) -> Locator:
        return self.page.locator("aside")

    @property
    def nav_toggle(self) -> Locator:
        return self.page.locator('[data-ai-id="shell:nav-toggle"]')

    def open_drawer(self) -> None:
        self.nav_toggle.click()
