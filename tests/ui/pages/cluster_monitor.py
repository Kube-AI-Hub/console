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

    #: Group order the page renders (GPU → host → disk I/O → network → RDMA).
    GROUPS = ("gpu", "host", "disk", "network", "rdma")

    #: Physical-resource cards added on top of the original thirteen.
    EXTRA_CARDS = (
        "gpu-memory",
        "gpu-utilization",
        "gpu-allocated",
        "disk-read-throughput",
        "disk-write-throughput",
        "disk-read-iops",
        "disk-write-iops",
        "rdma-health",
        "rdma-ports",
        "rdma-tx",
        "rdma-rx",
        "rdma-link-speed",
        "rdma-rx-errors",
        "rdma-retrans",
        "rdma-discards",
        "rdma-link-downed",
    )

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

    def _group_ids(self) -> list[str]:
        return [
            (element.get_attribute('data-ai-id') or '').split(':')[-1]
            for element in self.page.locator('[data-ai-id^="cluster-monitor:group:"]').all()
        ]

    def groups(self) -> list[str]:
        """Physical-resource group ids in render order, e.g. ['gpu', 'host', ...]."""
        return [group for group in self._group_ids() if group in self.GROUPS]

    def group_titles(self) -> list[str]:
        titles: list[str] = []
        for element in self.page.locator('[data-ai-id^="cluster-monitor:group:"]').all():
            if (element.get_attribute('data-ai-id') or '').split(':')[-1] not in self.GROUPS:
                continue
            titles.append(element.locator(':scope > h2').first.inner_text().strip())
        return titles

    # ---------------- 系统组件 ----------------

    #: Component sub-groups, in render order.
    COMPONENTS = ("apiserver", "scheduler", "etcd")

    #: Cards per component, in render order.
    COMPONENT_CARDS = {
        "apiserver": ("requestRate", "requestRateByVerb", "requestLatency"),
        "scheduler": ("scheduleAttempts", "scheduleAttemptRate", "scheduleLatency"),
        "etcd": (
            "dbSize",
            "walFsync",
            "backendCommit",
            "proposals",
            "proposalsPending",
            "clientTraffic",
            "grpcMessages",
        ),
    }

    def component_groups(self) -> list[str]:
        """Component sub-group ids in render order: apiserver, scheduler, etcd."""
        return [group for group in self._group_ids() if group in self.COMPONENTS]

    def component_group(self, component: str) -> Locator:
        return self.page.locator(f'section[data-ai-id="cluster-monitor:group:{component}"]')

    def component_state(self, component: str) -> str | None:
        return self.component_group(component).get_attribute("data-ai-state")

    def wait_component_state(self, component: str, expected: str, timeout_ms: int = 120_000) -> None:
        expect(self.component_group(component)).to_have_attribute("data-ai-state", expected, timeout=timeout_ms)

    def component_not_reported(self, component: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:components:not-reported:{component}"]').last

    def component_retry(self, component: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:components:retry:{component}"]')

    def component_card_keys(self, component: str) -> list[str]:
        prefix = f"cluster-monitor:{component}:"
        return [
            (element.get_attribute('data-ai-id') or '')[len(prefix):]
            for element in self.page.locator(f'section[data-ai-id^="{prefix}"]').all()
        ]

    def component_card(self, component: str, card: str) -> Locator:
        return self.page.locator(f'section[data-ai-id="cluster-monitor:{component}:{card}"]').last

    def component_card_latest(self, component: str, card: str) -> str:
        return self.page.locator(f'[data-ai-id="cluster-monitor:{component}:{card}:latest"]').last.inner_text().strip()

    def component_card_is_empty(self, component: str, card: str) -> bool:
        return self.page.locator(f'[data-ai-id="cluster-monitor:{component}:{card}:no-data"]').count() > 0

    def component_card_series(self, component: str, card: str) -> dict[str, str]:
        """Identity → printed value for one card's legend, e.g. {'result:scheduled': '4841'}."""
        base = f'cluster-monitor:{component}:{card}:series:'
        out: dict[str, str] = {}
        for element in self.page.locator(f'[data-ai-id^="{base}"][data-ai-id$=":value"]').all():
            ai_id = element.get_attribute('data-ai-id') or ''
            out[ai_id[len(base):-len(':value')]] = element.inner_text().strip()
        return out

    def component_card_chart_series(self, component: str, card: str) -> list[str]:
        """The identities that actually drew a line (a NaN-only identity draws none)."""
        return [
            element.get_attribute('data-ai-series') or ''
            for element in self.page.locator(f'[data-ai-id="cluster-monitor:{component}:{card}:chart"] path').all()
        ]

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
    def component_series(
        self,
        component: str,
        metrics: list[str],
        window_seconds: int = 3600,
        step: str = "60s",
    ) -> dict[str, list[tuple[dict[str, str], list[float]]]]:
        """One component's series for the same window shape the page uses.

        Returns metric → [(identity labels, finite values)]. Empty list means the metric
        was returned with no series at all — the「未上报」case, which is distinct from a
        series whose values are zero.
        """
        assert self.api is not None, "api client required"
        end = int(time.time())
        start = end - window_seconds
        metrics_filter = "|".join(f"{metric}$" for metric in metrics)
        status, body = self.api.request(
            "GET",
            f"/kapis/monitoring.kubesphere.io/v1alpha3/components/{component}"
            f"?cluster={self.cluster}&metrics_filter={metrics_filter}&start={start}&end={end}&step={step}",
        )
        assert status == 200, f"components/{component} -> {status}: {str(body)[:200]}"
        out: dict[str, list[tuple[dict[str, str], list[float]]]] = {}
        for result in (body or {}).get("results") or []:
            name = result.get("metric_name") or ""
            series: list[tuple[dict[str, str], list[float]]] = []
            for sample in (result.get("data") or {}).get("result") or []:
                values: list[float] = []
                for _at, value in sample.get("values") or []:
                    try:
                        parsed = float(value)
                    except (TypeError, ValueError):
                        continue
                    if parsed != parsed or parsed in (float("inf"), float("-inf")):
                        continue
                    values.append(parsed)
                series.append((sample.get("metric") or {}, values))
            out[str(name)] = series
        return out
