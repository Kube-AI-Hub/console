"""页面对象：kube-frontend 的配置字典列表。

选择器只出现在这里。用例按动作命名调用，不直接写 CSS，这样改版时只改一个文件。

选择器优先用 `data-ai-id`：它是新前端的对外契约（见 design/kube-frontend），
不随文案变化，也不依赖 DOM 层级。
"""

from __future__ import annotations

import time

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect


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
        """Only the headers actually rendered, which differs by viewport.

        `all_inner_texts` includes `display: none` cells, so a phone-width check
        that a column is folded away read the hidden header and reported it as
        visible.
        """
        return [
            text.strip()
            for text in self.surface.locator("thead th:visible").all_inner_texts()
            if text.strip()
        ]

    @property
    def search_box(self) -> Locator:
        return self.surface.locator('[data-ai-id="configmaps:search"]')

    def search(self, keyword: str) -> None:
        """Type a keyword and wait until the list actually reflects it.

        A fixed 400ms assumed the 250ms debounce had fired and the response was back.
        Two things routinely beat that: a controlled input can be re-rendered with the
        previous value mid-fill (leaving a truncated keyword behind), and the response
        can take longer than the sleep. Both looked like "search is broken".
        """
        for _ in range(20):
            self.search_box.fill(keyword)
            self.page.wait_for_timeout(300)
            if self.search_box.input_value() == keyword:
                break
        deadline = time.time() + 30
        while time.time() < deadline:
            names = self.row_names()
            # `all([])` is True: an empty table (skeleton rows while the request is in
            # flight) would satisfy "every visible name matches" immediately. Require
            # rows to exist, or the surface to have settled on empty.
            if names and all(keyword in name for name in names):
                return
            if not names and self.state == "empty":
                return
            self.page.wait_for_timeout(250)
        self.wait_ready()

    def sort_by(self, key: str) -> None:
        self.surface.locator(f'[data-ai-id="configmaps:sort:{key}"]').click()
        self.wait_ready()

    @property
    def bulk_delete(self) -> Locator:
        return self.surface.locator('[data-ai-id="configmaps:bulk-delete"]')

    def select_row(self, name: str) -> None:
        # The handle sits on the checkbox itself, not a wrapper: the label around
        # it is the enlarged touch target, not the targetable control.
        self.surface.locator(f'input[data-ai-id="configmaps:select:{name}"]').check()

    def delete_row(self, name: str) -> None:
        """Delete a row the way a person does: open its menu, choose 删除.

        There is no per-row delete button on screen — the action lives in the
        overflow menu — so addressing one by id would test a control that does
        not exist.
        """
        self.open_row_menu(name)
        self.click_row_action("删除")

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

    # ---------------- Row actions and dialogs ----------------

    @property
    def create_button(self) -> Locator:
        return self.surface.locator('[data-ai-id="configmaps:create"]')

    def ensure_row(self, name: str) -> None:
        """确保目标行在屏幕上；首页没有时用搜索定位。

        `open()` 只等列表就绪，不代表**这个对象**在屏幕上：新建的对象可能落在第二页，
        或被执行计划缓存的第一页挡住。按名称搜索既是用户的真实做法，也消除了只在
        全量运行时出现的 "row not found" 抖动。
        """
        row = self.surface.locator(f'[data-ai-row="{name}"]')
        try:
            row.wait_for(state="visible", timeout=4000)
            return
        except PlaywrightTimeoutError:
            pass
        self.search(name)
        self.surface.locator(f'[data-ai-row="{name}"]').wait_for(state="visible", timeout=15000)

    def open_row_menu(self, name: str) -> None:
        """打开某一行的「更多操作」菜单。"""
        self.ensure_row(name)
        self.surface.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()

    def click_row_action(self, action: str) -> None:
        """点击已展开的菜单项，`action` 是可见文案。"""
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    def open_detail(self, name: str) -> None:
        self.surface.locator(f'[data-ai-id="configmaps:open:{name}"]').click()
        expect(self.page.locator('[data-ai-id="configmap-detail:surface"]')).to_be_visible()

    @property
    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="configmap-detail:surface"]')

    @property
    def detail_data_rows(self) -> Locator:
        return self.detail_surface.locator("[data-ai-row]")

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    def fill_dialog_field(self, ai_id: str, value: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').fill(value)

    def confirm_dialog(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()

    @property
    def toast_text(self) -> list[str]:
        return [text.strip() for text in self.page.get_by_role("status").all_inner_texts() if text.strip()]


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
