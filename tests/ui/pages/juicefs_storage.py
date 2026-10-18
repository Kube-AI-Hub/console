"""页面对象：共享存储页。

选择器集中在这里，规格与用例不写 CSS。
"""

from __future__ import annotations

from typing import Any

from helpers.config import UiConfig

PAGE_PATH = "clusters/{cluster}/juicefs-storage"


class SharedStoragePage:
    def __init__(self, page: Any, config: UiConfig) -> None:
        self.page = page
        self.config = config

    # ---- navigation -----------------------------------------------------
    def open(self, tab: str = "overview") -> None:
        url = self.config.cluster_url(f"juicefs-storage/{tab}")
        self.page.goto(url, wait_until="domcontentloaded")
        self.wait_ready()

    def wait_ready(self) -> None:
        self.page.wait_for_selector("text=共享存储", timeout=30_000)
        # Cards/tables render after the first API round-trip.
        self.page.wait_for_load_state("networkidle", timeout=30_000)

    @property
    def content_selector(self) -> str:
        """The page's own content root.

        Not `main` (this layout has none) and not `#root` (that would include the
        cluster sidebar and the toolbox panel, whose colours belong to other
        pages). `.ks-page-main` is the content column the route renders into.
        """
        return ".ks-page-main"

    def open_tab(self, name: str) -> None:
        self.page.click(f".tabs a:has-text('{name}'), button:has-text('{name}')")
        self.page.wait_for_load_state("networkidle", timeout=30_000)

    # ---- overview -------------------------------------------------------
    @property
    def cards(self) -> list[dict]:
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('[class*=cardTitle]')).map((title) => {
              const card = title.parentElement
              const value = card && card.querySelector('[class*=cardValue]')
              return { title: title.textContent.trim(), value: value ? value.textContent.trim() : '' }
            })
            """
        )

    @property
    def usage_rows(self) -> list[dict]:
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('[class*=usageRow]')).map((row) => {
              const name = row.querySelector('[class*=usageName]')
              const value = row.querySelector('[class*=usageValue]')
              return {
                name: name ? name.textContent.trim() : '',
                value: value ? value.textContent.trim() : '',
              }
            })
            """
        )

    @property
    def hints(self) -> list[str]:
        return self.page.evaluate(
            "() => Array.from(document.querySelectorAll('[class*=hint]')).map((el) => el.textContent.trim())"
        )

    # ---- volumes --------------------------------------------------------
    @property
    def table_headers(self) -> list[str]:
        return self.page.evaluate(
            "() => Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent.trim())"
        )

    @property
    def table_rows(self) -> list[list[str]]:
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('tbody tr')).map((row) =>
              Array.from(row.querySelectorAll('td')).map((td) => td.textContent.trim())
            )
            """
        )

    def open_quota(self, row_index: int = 0) -> None:
        buttons = self.page.locator("tbody tr button:has-text('调整配额')")
        buttons.nth(row_index).click()
        self.page.wait_for_selector("text=新配额", timeout=10_000)

    @property
    def quota_input(self) -> Any:
        return self.page.locator("input[name=capacity]")

    @property
    def quota_unit(self) -> Any:
        return self.page.locator("select")

    def quota_dialog_text(self) -> str:
        return self.page.evaluate(
            """
            () => {
              const dialog = document.querySelector('[class*=modal], [role=dialog]')
              return dialog ? dialog.textContent.trim() : ''
            }
            """
        )

    def submit_quota(self) -> None:
        self.page.click("button:has-text('确定')")

    def cancel_quota(self) -> None:
        self.page.click("button:has-text('取消')")

    @property
    def quota_ok_disabled(self) -> bool:
        return self.page.evaluate(
            """
            () => {
              const buttons = Array.from(document.querySelectorAll('button'))
              const ok = buttons.find((b) => b.textContent.trim() === '确定')
              return !ok || ok.disabled || ok.className.includes('disabled')
            }
            """
        )

    # ---- performance ----------------------------------------------------
    @property
    def chart_titles(self) -> list[str]:
        """The six chart titles, or an empty list when the metrics are off."""
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('[class*=chartName]'))
                    .map((el) => el.textContent.trim())
                    .filter(Boolean)
            """
        )

    @property
    def chart_curves(self) -> int:
        return self.page.evaluate(
            "() => document.querySelectorAll('path.recharts-curve').length"
        )

    @property
    def body_text(self) -> str:
        return self.page.evaluate("() => document.body.innerText")
