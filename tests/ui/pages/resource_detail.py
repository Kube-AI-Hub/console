"""页面对象：资源详情页（Pod 作为代表）与「资源不存在」的提示 / 回退。

选择器集中在这里，规格与用例不写 CSS。
"""

from __future__ import annotations

from typing import Any

from helpers.config import UiConfig

NOT_FOUND_TITLE = "资源不存在"
NOT_FOUND_RAW_TEXTS = ("NotFound", "not found")

# Pod 详情页的页签（标题 → 路由段）。
TAB_TITLES = ("资源状态", "调度信息", "元数据", "监控", "环境变量", "事件")
TAB_ROUTES = {
    "资源状态": "resource-status",
    "调度信息": "schedule",
    "元数据": "metadata",
    "监控": "monitors",
    "环境变量": "env",
    "事件": "events",
}


class ResourceDetailPage:
    def __init__(self, page: Any, config: UiConfig) -> None:
        self.page = page
        self.config = config

    # ---- navigation -----------------------------------------------------
    def open_pod_list(self, namespace: str = "agent-platform") -> None:
        url = self.config.url(
            f"clusters/{self.config.cluster}/projects/{namespace}/pods"
        )
        self.page.goto(url, wait_until="domcontentloaded")
        self.wait_for_pod_cards()

    def open_pod_detail(self, pod: str, tab: str = "resource-status",
                        namespace: str = "agent-platform") -> None:
        url = self.config.url(
            f"clusters/{self.config.cluster}/projects/{namespace}/pods/{pod}/{tab}"
        )
        self.page.goto(url, wait_until="domcontentloaded")

    def open_missing_pod(self, pod: str = "kube-ai-hub-not-exist",
                         tab: str = "resource-status",
                         namespace: str = "agent-platform") -> None:
        self.open_pod_detail(pod, tab, namespace)

    # ---- list -----------------------------------------------------------
    def wait_for_pod_cards(self, namespace: str = "agent-platform",
                           timeout_ms: int = 30_000) -> None:
        """项目级 Pod 列表是卡片布局（不是表格），等详情链接出现即可。

        只等 `a[href*="/pods/"]` 会把容器链接也算进来，所以要求 href 里
        `/pods/<name>` 之后没有更多路径段。
        """
        self.page.wait_for_function(
            """
            (ns) => Array.from(document.querySelectorAll('a[href]')).some((a) => {
              const href = a.getAttribute('href') || ''
              const m = new RegExp(`/projects/${ns}/pods/([^/]+)$`).exec(href)
              return !!m
            })
            """,
            arg=namespace,
            timeout=timeout_ms,
        )

    @property
    def first_pod_name(self) -> str:
        """列表里第一个 Pod 的名称，取自详情链接（卡片上的名称会重复渲染）。"""
        return self.page.evaluate(
            """
            (ns) => {
              const re = new RegExp(`/projects/${ns}/pods/([^/]+)$`)
              const link = Array.from(document.querySelectorAll('a[href]'))
                .find((a) => re.test(a.getAttribute('href') || ''))
              if (!link) return ''
              const m = re.exec(link.getAttribute('href'))
              return m ? m[1] : ''
            }
            """,
            "agent-platform",
        )

    def wait_for_list(self, namespace: str = "agent-platform",
                      timeout_ms: int = 15_000) -> None:
        self.page.wait_for_url(
            f"**/clusters/{self.config.cluster}/projects/{namespace}/pods",
            timeout=timeout_ms,
        )
        self.wait_for_pod_cards(namespace, timeout_ms)

    # ---- detail ---------------------------------------------------------
    def wait_for_detail(self, pod: str, tab: str = "resource-status",
                        timeout_ms: int = 30_000) -> None:
        """等详情页真正渲染：地址栏到位 + 侧栏名称非空。

        只等 URL 不够：路由切换是同步的，详情数据是异步的，紧接着读标题会拿到
        空字符串。
        """
        self.page.wait_for_url(f"**/pods/{pod}/{tab}", timeout=timeout_ms)
        self.page.wait_for_function(
            """
            (name) => {
              const el = document.querySelector('[data-test="detail-title"]')
              return !!el && el.textContent.trim() === name
            }
            """,
            arg=pod,
            timeout=timeout_ms,
        )

    @property
    def detail_title(self) -> str:
        """左侧摘要的名称。"""
        return self.page.evaluate(
            """
            () => {
              const el = document.querySelector('[data-test="detail-title"]')
              return el ? el.textContent.trim() : ''
            }
            """
        )

    @property
    def tabs(self) -> list[str]:
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('a'))
                    .map((a) => a.textContent.trim())
                    .filter((t) => t && t.length < 12)
            """
        )

    def click_tab(self, title: str) -> None:
        self.page.click(f"a:has-text('{title}')")
        self.page.wait_for_url(f"**/{TAB_ROUTES[title]}", timeout=15_000)
        # 页签切换后主区重新渲染，等 URL 之外再确认一次左侧摘要还在。
        self.page.wait_for_function(
            """
            () => {
              const el = document.querySelector('[data-test="detail-title"]')
              return !!el && el.textContent.trim().length > 0
            }
            """,
            timeout=15_000,
        )

    @property
    def current_path(self) -> str:
        return self.page.evaluate("() => location.pathname")

    # ---- not-found notice ------------------------------------------------
    @property
    def notices(self) -> list[dict]:
        """右上角提示：标题 + 正文。"""
        return self.page.evaluate(
            """
            () => Array.from(document.querySelectorAll('.notice'))
              .map((n) => {
                const title = n.querySelector('.notify-title')
                const content = n.querySelector('.notify-content')
                return {
                  title: title ? title.textContent.trim() : '',
                  content: content ? content.textContent.trim() : '',
                }
              })
            """
        )

    @property
    def not_found_notices(self) -> list[dict]:
        return [n for n in self.notices if n["title"] == NOT_FOUND_TITLE]

    def wait_for_not_found_notice(self, timeout_ms: int = 10_000) -> dict:
        self.page.wait_for_selector(
            f".notice:has-text('{NOT_FOUND_TITLE}')", timeout=timeout_ms
        )
        hits = self.not_found_notices
        return hits[0] if hits else {}

    @property
    def body_text(self) -> str:
        return self.page.evaluate("() => document.body.innerText")

    @property
    def raw_not_found_texts(self) -> list[str]:
        """页面上出现的后端原文（`NotFound` / `not found`）。"""
        text = self.body_text
        return [raw for raw in NOT_FOUND_RAW_TEXTS if raw in text]
