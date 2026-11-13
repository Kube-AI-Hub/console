"""页面对象：kube-frontend 的集群监控。

四个趋势卡片，数据来自 KubeSphere 监控的 range query。这里只负责定位与取值；
「百分比是否由用量除总量算出」由用例拿接口数据自行核对，因为页面上的数字正确
不代表算法正确（把字节当百分比也会得到一个数字）。
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

MONITORING_CLUSTER = "/kapis/monitoring.kubesphere.io/v1alpha3/cluster"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class ClusterMonitorPage:
    """集群监控页。"""

    CARDS = ("cpu", "memory", "pods", "nodes")

    def __init__(self, page: Page, base_url: str, cluster: str = "host", api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.cluster = cluster
        self.api = api

    @property
    def url(self) -> str:
        return f"{self.base_url}/kube-frontend/clusters/{self.cluster}/monitor"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:surface"]').last

    def open(self) -> None:
        self.page.goto(self.url)
        expect(self.surface).to_be_visible(timeout=30_000)

    def wait_ready(self, timeout_ms: int = 120_000) -> None:
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self) -> str | None:
        return self.surface.get_attribute("data-ai-state")

    def charts(self) -> int:
        return self.page.locator('[data-ai-id="cluster-monitor:chart"]').count()

    def latest(self, card: str) -> str:
        return self.page.locator(f'[data-ai-id="cluster-monitor:{card}:latest"]').last.inner_text().strip()

    def card_text(self, card: str) -> str:
        return self.page.locator(f'[data-ai-id="cluster-monitor:{card}"]').last.inner_text()

    def empty_cards(self) -> int:
        return self.page.locator('[data-ai-id$=":empty"]').count()

    def select_range(self, key: str) -> None:
        self.page.locator(f'[data-ai-id="cluster-monitor:range:{key}"]').click()

    # ---------------- 数据 ----------------

    def _range(self, window_seconds: int, step: str, metrics: list[str]) -> dict[str, Any] | None:
        assert self.api is not None, "api client required"
        end = int(time.time())
        start = end - window_seconds
        metrics_filter = "|".join(f"{metric}$" for metric in metrics)
        status, body = self.api.request(
            "GET",
            f"{MONITORING_CLUSTER}?cluster={self.cluster}&metrics_filter={metrics_filter}"
            f"&start={start}&end={end}&step={step}",
        )
        if status != 200 or not isinstance(body, dict):
            return None
        out: dict[str, list[tuple[int, float]]] = {}
        for result in body.get("results") or []:
            name = result.get("metric_name")
            samples = ((result.get("data") or {}).get("result")) or []
            points: list[tuple[int, float]] = []
            for sample in samples:
                for at, value in sample.get("values") or []:
                    try:
                        points.append((int(at), float(value)))
                    except (TypeError, ValueError):
                        continue
            if name and points:
                out[str(name)] = points
        return out or None
