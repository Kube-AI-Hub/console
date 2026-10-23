"""页面对象：显卡列表（集群页 / 节点运行状态页 / 单卡详情）。

选择器集中在这里，规格与用例不写 CSS。
"""

from __future__ import annotations

from typing import Any

from helpers.config import UiConfig

CLUSTER_PAGE = "gpus"
NODE_STATUS_PAGE = "nodes/{node}/status"

HEALTHY_TEXT = "健康"
SUB_HEALTHY_TEXT = "亚健康"

# The status cell of the cluster table is column index 3 (节点/序号/UUID/状态).
CLUSTER_STATUS_COLUMN = 3
# The node status page table has no node column, so status is index 2.
NODE_STATUS_COLUMN = 2


class GpuCardsPage:
    def __init__(self, page: Any, config: UiConfig) -> None:
        self.page = page
        self.config = config

    # ---- navigation -----------------------------------------------------
    def open_cluster(self) -> None:
        self.page.goto(self.config.cluster_url(CLUSTER_PAGE), wait_until="domcontentloaded")
        self.wait_ready()

    def open_node_status(self, node: str) -> None:
        url = self.config.cluster_url(NODE_STATUS_PAGE.format(node=node))
        self.page.goto(url, wait_until="domcontentloaded")
        self.wait_ready()

    def wait_ready(self) -> None:
        self.page.wait_for_load_state("networkidle", timeout=30_000)

    @property
    def content_selector(self) -> str:
        return ".ks-page-main"

    @property
    def body_text(self) -> str:
        return self.page.evaluate("() => document.body.innerText")

    # ---- cluster table --------------------------------------------------
    @property
    def cluster_headers(self) -> list[str]:
        return self.page.evaluate(
            "() => Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent.trim())"
        )

    @property
    def cluster_rows(self) -> list[dict]:
        """One entry per row: uuid, status text, and the single-card detail link.

        The UUID cell wraps its text in a Tooltip, which renders the content twice
        (once for the trigger, once for the tooltip body). Read the anchor's own
        text instead of the cell's `textContent`.

        The node column is also a link (`.../nodes/<node>/status`), so the card
        link has to come from the UUID cell specifically, not from `row a`.
        """
        return self.page.evaluate(
            """
            (statusIndex) => Array.from(document.querySelectorAll('tbody tr')).map((row) => {
              const cells = Array.from(row.querySelectorAll('td'))
              const text = (i) => (cells[i] ? cells[i].textContent.trim() : '')
              const link = cells[2] ? cells[2].querySelector('a') : null
              return {
                uuid: link ? link.textContent.trim() : text(2),
                status: text(statusIndex),
                href: link ? link.getAttribute('href') : '',
                cells: cells.map((c) => c.textContent.trim()),
              }
            })
            """,
            CLUSTER_STATUS_COLUMN,
        )

    # ---- node status card -----------------------------------------------
    def gpu_card_rows(self, node: str) -> list[dict]:
        """Rows of the node page's 显卡列表 panel.

        The node status page renders several panels; scope the query to the one
        whose title is 显卡列表 so the RDMA table and the topology matrix do not
        leak in.
        """
        return self.page.evaluate(
            """
            (statusIndex) => {
              const panels = Array.from(document.querySelectorAll('[class*=panel], section, div'))
              const panel = panels.find((el) => {
                const title = el.querySelector('[class*=title], h3, [class*=panelTitle]')
                return title && title.textContent.trim() === '显卡列表'
              })
              const root = panel || document
              return Array.from(root.querySelectorAll('tbody tr')).map((row) => {
                const cells = Array.from(row.querySelectorAll('td'))
                const text = (i) => (cells[i] ? cells[i].textContent.trim() : '')
                const link = row.querySelector('a')
                return {
                  uuid: link ? link.textContent.trim() : text(1),
                  status: text(statusIndex),
                  cells: cells.map((c) => c.textContent.trim()),
                }
              })
            }
            """,
            NODE_STATUS_COLUMN,
        )

    # ---- single card detail ---------------------------------------------
    def open_card(self, href: str) -> None:
        self.page.goto(self.config.url(href.lstrip("/")), wait_until="domcontentloaded")
        self.page.wait_for_load_state("networkidle", timeout=30_000)

    @property
    def card_status(self) -> str:
        """The value next to the 状态 attribute in the side panel.

        The attribute list renders each pair as "状态:" followed by the value, and
        the markup nests both inside wrappers whose class names are shared with
        other panels, so read it from the panel's text instead of a class selector.
        """
        return self.page.evaluate(
            """
            () => {
              const text = document.body.innerText
              const match = /状态[:：]\\s*\\n?\\s*(健康|亚健康)/.exec(text)
              return match ? match[1] : ''
            }
            """
        )

    # ---- API ------------------------------------------------------------
    def gpu_api(self, node: str | None = None) -> dict:
        """Call the same kapis endpoint the page uses."""
        return self.page.evaluate(
            """
            async (nodeName) => {
              const token = localStorage.getItem('kah_token') || localStorage.getItem('token')
              const conditions = nodeName ? `?conditions=nodeName=${encodeURIComponent(nodeName)}` : ''
              const response = await fetch(`/kapis/gpu.kubesphere.io/v1alpha1/gpus${conditions}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              return response.ok ? await response.json() : { items: [], totalItems: 0, status: response.status }
            }
            """,
            node,
        )

    def node_register(self, node: str) -> dict:
        """Read the device plugin's register annotation straight from the Node object."""
        return self.page.evaluate(
            """
            async (nodeName) => {
              const token = localStorage.getItem('kah_token') || localStorage.getItem('token')
              const response = await fetch(`/kapis/resources.kubesphere.io/v1alpha3/nodes/${nodeName}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (!response.ok) return {}
              const body = await response.json()
              const annotations = body.annotations || (body.metadata && body.metadata.annotations) || {}
              const out = {}
              Object.keys(annotations).forEach((key) => {
                if (key.startsWith('hami.io/node-') && key.endsWith('-register')) {
                  try {
                    out[key] = JSON.parse(annotations[key])
                  } catch (e) {
                    out[key] = null
                  }
                }
              })
              return out
            }
            """,
            node,
        )
