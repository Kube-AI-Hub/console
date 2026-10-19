"""页面对象：共享存储页。

选择器集中在这里，规格与用例不写 CSS。
"""

from __future__ import annotations

from typing import Any

from helpers.config import UiConfig

PAGE_PATH = "clusters/{cluster}/juicefs-storage"

# The three tabs are rendered by the Banner as radio buttons, not links: clicking
# is what changes the route, and the URL is the assertion that it did.
TAB_LABELS = ("概览", "卷与配额", "性能")
TAB_ROUTES = {"概览": "overview", "卷与配额": "volumes", "性能": "performance"}


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

    @property
    def tabs(self) -> list[str]:
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('label.radio-button'))
                    .map((el) => el.textContent.trim())
                    .filter(Boolean)
            """
        )

    def click_tab(self, name: str) -> None:
        """Click a tab and wait until the route reflects it.

        `networkidle` is not usable on the performance tab: the monitoring
        controller keeps a request open for its auto-refresh, so the page never
        reaches idle. Wait for the route, then for the content of that tab.
        """
        self.page.click(f"label.radio-button:has-text('{name}')")
        expected = TAB_ROUTES[name]
        self.page.wait_for_url(f"**/juicefs-storage/{expected}", timeout=15_000)

        if expected == "performance":
            # Charts render after the first monitoring response.
            self.page.wait_for_selector("[class*=chartName]", timeout=30_000)
        elif expected == "volumes":
            self.page.wait_for_selector("thead th", timeout=30_000)
        else:
            self.page.wait_for_selector("[class*=cardTitle]", timeout=30_000)

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

    def card_bytes(self, title: str) -> int:
        """Exact byte value of a summary card (the visible text is rounded)."""
        return self.page.evaluate(
            """
            (label) => {
              const titles = Array.from(document.querySelectorAll('[class*=cardTitle]'))
              const hit = titles.find((el) => el.textContent.trim() === label)
              if (!hit) return 0
              const value = hit.parentElement.querySelector('[class*=cardValue]')
              const raw = value && value.getAttribute('data-bytes')
              return raw ? Number(raw) : 0
            }
            """,
            title,
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

    @property
    def quota_buttons(self) -> int:
        return self.page.evaluate(
            "() => document.querySelectorAll('tbody tr button').length"
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

    def row_quota(self, row_index: int = 0) -> str:
        """The quota cell of a row, as displayed."""
        return self.page.evaluate(
            """
            (index) => {
              const row = document.querySelectorAll('tbody tr')[index]
              const cell = row && row.querySelectorAll('td')[2]
              return cell ? cell.textContent.trim() : ''
            }
            """,
            row_index,
        )

    def row_bytes(self, row_index: int = 0) -> dict:
        """Exact byte counts from the quota/used cells.

        The visible text is rounded ("5.0 TiB"); the page carries the raw counts on
        `data-bytes` so a test can compare numbers without losing precision.
        """
        return self.page.evaluate(
            """
            (index) => {
              const row = document.querySelectorAll('tbody tr')[index]
              if (!row) return {}
              const cells = row.querySelectorAll('td')
              const pick = (cell) => {
                const el = cell && cell.querySelector('[data-bytes]')
                return el ? Number(el.getAttribute('data-bytes')) : null
              }
              return { capacity: pick(cells[2]), used: pick(cells[3]) }
            }
            """,
            row_index,
        )

    def volume_name(self, row_index: int = 0) -> str:
        return self.page.evaluate(
            """
            (index) => {
              const row = document.querySelectorAll('tbody tr')[index]
              const el = row && row.querySelector('[data-volume]')
              return el ? el.getAttribute('data-volume') : ''
            }
            """,
            row_index,
        )

    def wait_row_capacity(self, target: int, row_index: int = 0, timeout_ms: int = 150_000) -> int:
        """Wait until the row's PV capacity equals `target` bytes.

        The quota write runs a one-shot job and the API takes ~10s, after which the
        store refetches the list. Waiting on the value (not on the "待刷新" label)
        is right: the label reflects statfs lag, which persists until the mount is
        republished and is not a signal that the write finished.
        """
        self.page.wait_for_function(
            """
            ([index, target]) => {
              const row = document.querySelectorAll('tbody tr')[index]
              if (!row) return false
              const el = row.querySelectorAll('td')[2].querySelector('[data-bytes]')
              return el && Number(el.getAttribute('data-bytes')) === target
            }
            """,
            arg=[row_index, target],
            timeout=timeout_ms,
        )
        return self.row_bytes(row_index).get('capacity') or 0

    def set_quota_api(self, volume: str, capacity: str) -> int:
        """Set a quota through the same API the page uses (for cleanup)."""
        return self.page.evaluate(
            """
            async ([name, cap]) => {
              const token = localStorage.getItem('kah_token') || localStorage.getItem('token')
              const response = await fetch(
                `/kapis/juicefs.kubesphere.io/v1alpha1/volumes/${name}`,
                {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ capacity: cap }),
                }
              )
              return response.status
            }
            """,
            [volume, capacity],
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
    def chart_totals(self) -> list[str]:
        """The range-total lines under the chart titles."""
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('[class*=chartTotal]'))
                    .map((el) => el.textContent.trim())
                    .filter(Boolean)
            """
        )

    @property
    def empty_charts(self) -> list[str]:
        """Charts that rendered the "no traffic" state instead of a zero line."""
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('[class*=emptyChart]'))
                    .map((el) => el.textContent.trim())
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
