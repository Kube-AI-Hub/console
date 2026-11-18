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

    def open(self, tab: str | None = None) -> None:
        """Open the page, optionally deep-linking a tab via `?tab=`."""
        self.page.goto(self.url if tab is None else f"{self.url}?tab={tab}")
        expect(self.surface).to_be_visible(timeout=30_000)
        if tab is not None:
            expect(self.tabpanel(tab)).to_be_visible(timeout=30_000)

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

    # ---------------- 集群状态分区 ----------------

    #: Service components, keyed by the namespace componenthealth reports.
    SERVICE_NAMESPACES = (
        "kubesphere-system",
        "kube-system",
        "istio-system",
        "kubesphere-monitoring-system",
        "kubesphere-logging-system",
        "kubesphere-devops-system",
    )

    #: Core components, in render order.
    CORE_COMPONENTS = ("etcd", "controller-manager", "scheduler")

    @property
    def status_section(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:status"]').last

    def status_section_state(self) -> str | None:
        return self.status_section.get_attribute("data-ai-state")

    #: The status band's block handles after the 2026-11-18 tab/chart rework.
    STATUS_BLOCKS = {
        "node-online": "cluster-monitor:overview:node-ring",
        "vendor": "cluster-monitor:overview:vendor-donut",
        "components": "cluster-monitor:status:components",
    }

    def status_card(self, block: str) -> Locator:
        """One of the three status cards: node-online / vendor / components."""
        return self.page.locator(f'[data-ai-id="{self.STATUS_BLOCKS[block]}"]').last

    def status_card_state(self, block: str) -> str | None:
        return self.status_card(block).get_attribute("data-ai-state")

    # -- node online --

    def status_node_ratio_locator(self) -> Locator:
        """The healthy/total text beside the node ring."""
        return self.page.locator('[data-ai-id="cluster-monitor:overview:node-ring:count"]').last

    def status_node_ratio(self) -> str:
        return self.status_node_ratio_locator().inner_text().strip()

    def status_node_percent(self) -> str:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:node-ring:value"]').last.inner_text().strip()

    def status_node_link(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:node-ring:link"]').last

    def status_node_unreported(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:status:node-online:unreported"]').last

    def status_node_empty(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:status:node-online:empty"]').last

    def status_node_branch(self, key: str) -> Locator:
        """A node-online branch marker: loading / error / permission."""
        return self.page.locator(f'[data-ai-id="cluster-monitor:status:node-online:{key}"]').last

    # -- vendor distribution --

    def status_vendor_list(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:vendor-donut:legend"]').last

    def status_vendor_empty(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:status:vendor:empty"]').last

    def status_vendor_branch(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:status:vendor:{key}"]').last

    def _row_ids(self, prefix: str) -> list[str]:
        """Row ids under a prefix that have no further segment (children excluded)."""
        out: list[str] = []
        for element in self.page.locator(f'[data-ai-id^="{prefix}"]').all():
            ai_id = element.get_attribute('data-ai-id') or ''
            key = ai_id[len(prefix):]
            if key and ':' not in key:
                out.append(key)
        return out

    def status_vendor_ids(self) -> list[str]:
        return self._row_ids("cluster-monitor:overview:vendor:")

    def status_vendor_row(self, vendor: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:overview:vendor:{vendor}"]').last

    def status_vendor_count(self, vendor: str) -> str:
        return self.page.locator(f'[data-ai-id="cluster-monitor:overview:vendor:{vendor}:count"]').last.inner_text().strip()

    def status_vendor_percent(self, vendor: str) -> str:
        return self.page.locator(f'[data-ai-id="cluster-monitor:overview:vendor:{vendor}:percent"]').last.inner_text().strip()

    # -- component status --

    def status_service_ids(self) -> list[str]:
        return self._row_ids("cluster-monitor:status:components:service:")

    def status_service_row(self, namespace: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:status:components:service:{namespace}"]').last

    def status_service_status(self, namespace: str) -> str | None:
        return self.status_service_row(namespace).get_attribute("data-ai-status")

    def status_core_ids(self) -> list[str]:
        return self._row_ids("cluster-monitor:status:components:core:")

    def status_core_row(self, component: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:status:components:core:{component}"]').last

    def status_core_status(self, component: str) -> str | None:
        return self.status_core_row(component).get_attribute("data-ai-status")

    # -- block-level branches --

    def status_permission(self) -> Locator:
        """The components block's canonical 403 panel (cluster-monitor:status:permission)."""
        return self.page.locator('[data-ai-id="cluster-monitor:status:permission"]').last

    def status_error(self) -> Locator:
        """The components block's canonical 5xx panel (cluster-monitor:status:error)."""
        return self.page.locator('[data-ai-id="cluster-monitor:status:error"]').last

    def status_retry(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:status:retry"]').last

    def status_block_error(self, block: str) -> Locator:
        """A block's own error panel; block is node-online / vendor."""
        return self.page.locator(f'[data-ai-id="cluster-monitor:status:{block}:error"]').last

    def status_block_retry(self, block: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:status:{block}:retry"]').last

    def status_block_permission(self, block: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:status:{block}:permission"]').last

    # ---------------- 集群状态数据 ----------------

    def _cluster_path(self, prefix: str, rest: str) -> str:
        if not self.cluster or self.cluster == "host":
            return f"{prefix}/{rest}"
        return f"{prefix}/clusters/{self.cluster}/{rest}"

    def component_health(self) -> tuple[int, dict[str, Any]]:
        """GET componenthealth for this cluster, the same read the page makes."""
        assert self.api is not None, "api client required"
        return self.api.request("GET", self._cluster_path("/kapis/resources.kubesphere.io/v1alpha2", "componenthealth"))

    def node_vendor_stats(self) -> tuple[int, dict[str, Any]]:
        assert self.api is not None, "api client required"
        return self.api.request("GET", self._cluster_path("/kapis/resources.kubesphere.io/v1alpha3", "nodes/stats"))

    def etcd_service_monitor(self) -> tuple[int, dict[str, Any]]:
        """200 = etcd is wired into monitoring, 404 = it is not."""
        assert self.api is not None, "api client required"
        return self.api.request(
            "GET",
            self._cluster_path(
                "/apis/monitoring.coreos.com/v1/namespaces/kubesphere-monitoring-system",
                "servicemonitors/etcd",
            ),
        )

    def configz(self) -> tuple[int, dict[str, Any]]:
        """The cluster's module switches (servicemesh / monitoring / logging / devops)."""
        assert self.api is not None, "api client required"
        return self.api.request("GET", "/kapis/config.kubesphere.io/v1alpha2/configs/configz")

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

    # ---------------- 页签 IA（2026-11-18 起页面改为页内页签） ----------------

    #: Tab keys, in render order (contract §1).
    TABS = ("overview", "resource", "apiserver", "scheduler", "ranking")

    @property
    def tablist(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:tab:overview"]').locator("xpath=..")

    def tab(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:tab:{key}"]').last

    def tab_ids(self) -> list[str]:
        """Tab ids in render order, from the trigger handles."""
        prefix = "cluster-monitor:tab:"
        out: list[str] = []
        for element in self.page.locator(f'[data-ai-id^="{prefix}"]').all():
            ai_id = element.get_attribute("data-ai-id") or ""
            key = ai_id[len(prefix):]
            if key and ":" not in key:
                out.append(key)
        return out

    def tabpanel(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:tabpanel:{key}"]').last

    def tabpanel_state(self, key: str) -> str | None:
        return self.tabpanel(key).get_attribute("data-ai-state")

    def active_tab(self) -> str | None:
        """The selected tab key, read from the trigger's Radix state."""
        for element in self.page.locator('[data-ai-id^="cluster-monitor:tab:"]').all():
            if element.get_attribute("data-state") == "active" or element.get_attribute("aria-selected") == "true":
                return (element.get_attribute("data-ai-id") or "").split(":")[-1]
        return None

    def select_tab(self, key: str, timeout_ms: int = 30_000) -> None:
        self.tab(key).click()
        expect(self.tabpanel(key)).to_be_visible(timeout=timeout_ms)
        expect(self.tab(key)).to_have_attribute("data-state", "active", timeout=timeout_ms)

    def wait_tabpanel_ready(self, key: str, timeout_ms: int = 120_000) -> None:
        """Wait until the tab's panel leaves the loading state (when it exposes one)."""
        panel = self.tabpanel(key)
        expect(panel).to_be_visible(timeout=timeout_ms)
        state = panel.get_attribute("data-ai-state")
        if state is not None:
            expect(panel).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    # ---------------- 通用图表句柄（契约 §2） ----------------

    def chart(self, chart_id: str) -> Locator:
        return self.page.locator(f'[data-ai-id="{chart_id}"]').last

    def chart_state(self, chart_id: str) -> str | None:
        return self.chart(chart_id).get_attribute("data-ai-state")

    def chart_empty(self, chart_id: str) -> Locator:
        """The required no-data explanation: `<chart id>:empty`."""
        return self.page.locator(f'[data-ai-id="{chart_id}:empty"]').last

    def chart_is_empty(self, chart_id: str) -> bool:
        return self.chart_empty(chart_id).count() > 0

    def chart_has_line(self, chart_id: str) -> bool:
        """True when at least one finite series was drawn (a zero line is not a line here)."""
        return self.chart(chart_id).locator("path[data-ai-trend-line]").count() > 0

    def chart_series_ids(self, chart_id: str) -> list[str]:
        """Identity of every drawn line, e.g. ['verb:GET', 'verb:PUT']."""
        return [
            element.get_attribute("data-ai-series") or ""
            for element in self.chart(chart_id).locator("path[data-ai-trend-line]").all()
        ]

    def chart_legend(self, chart_id: str) -> Locator:
        return self.page.locator(f'[data-ai-id="{chart_id}:legend"]').last

    def chart_legend_items(self, chart_id: str) -> list[str]:
        """Legend entries as printed (colour dot + identity + value), one per child element."""
        legend = self.chart_legend(chart_id)
        if legend.count() == 0:
            return []
        items = legend.locator("[data-ai-segment], li")
        if items.count() == 0:
            return [line.strip() for line in legend.inner_text().splitlines() if line.strip()]
        return [item.inner_text().strip() for item in items.all() if item.inner_text().strip()]

    def chart_svg_count(self, chart_id: str) -> int:
        return self.chart(chart_id).locator("svg").count()

    def chart_legend_value(self, chart_id: str, series_key: str) -> str:
        """The latest value printed next to one legend line, e.g. '25%' or '3.10'."""
        return self.page.locator(
            f'[data-ai-id="{chart_id}:legend:{series_key}:value"]'
        ).last.inner_text().strip()

    # ---------------- 概览页签（契约 §2/§4） ----------------

    OVERVIEW_USAGE_KEYS = ("gpuMemory", "gpu", "gpuAllocated", "cpu", "memory", "disk", "pods")

    def overview_node_ring(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:node-ring"]').last

    def overview_node_ring_text(self) -> str:
        return self.overview_node_ring().inner_text().strip()

    def overview_node_ring_value(self) -> str:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:node-ring:value"]').last.inner_text().strip()

    def overview_vendor_donut(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:vendor-donut"]').last

    def overview_vendor_row(self, vendor: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:overview:vendor:{vendor}"]').last

    def overview_vendor_ids(self) -> list[str]:
        return self._row_ids("cluster-monitor:overview:vendor:")

    def overview_vendor_row_text(self, vendor: str) -> str:
        return self.overview_vendor_row(vendor).inner_text().strip()

    def overview_usage(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:usage"]').last

    def overview_usage_keys(self) -> list[str]:
        return self._row_ids("cluster-monitor:overview:usage:")

    def overview_usage_row(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:overview:usage:{key}"]').last

    def overview_usage_value(self, key: str) -> str:
        return self.page.locator(f'[data-ai-id="cluster-monitor:overview:usage:{key}:value"]').last.inner_text().strip()

    def overview_usage_chart(self) -> Locator:
        return self.chart("cluster-monitor:overview:usage-chart")

    def overview_usage_chart_legend(self) -> Locator:
        return self.chart_legend("cluster-monitor:overview:usage-chart")

    def overview_usage_chart_series(self) -> list[str]:
        return self.chart_series_ids("cluster-monitor:overview:usage-chart")

    def overview_usage_chart_empty(self) -> Locator:
        return self.chart_empty("cluster-monitor:overview:usage-chart")

    def overview_rdma(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:rdma"]').last

    def overview_view_rdma(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:overview:view-rdma"]').last

    # ---------------- 物理资源页签（契约 §5） ----------------

    RESOURCE_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("gpu", ("gpuMemory", "gpuUtilization", "gpuAllocated")),
        ("host", ("cpu", "memory", "load", "diskUsage", "inode", "pods")),
        ("disk", ("throughput", "iops")),
        ("network", ("traffic",)),
        ("rdma", ("health", "ports", "throughput", "linkSpeed", "errors", "linkDowned")),
    )

    def resource_groups(self) -> list[str]:
        return self._row_ids("cluster-monitor:resource:group:")

    def resource_group(self, group: str) -> Locator:
        return self.page.locator(f'[data-ai-id="cluster-monitor:resource:group:{group}"]').last

    @staticmethod
    def resource_chart_id(group: str, key: str) -> str:
        """The chart's global handle: `<group>:<key>` (throughput exists in two groups)."""
        return f"cluster-monitor:resource:chart:{group}:{key}"

    def resource_chart_ids(self) -> list[str]:
        """`<group>:<key>` of every chart in render order, without legend/empty children."""
        prefix = "cluster-monitor:resource:chart:"
        out: list[str] = []
        for element in self.page.locator(f'[data-ai-id^="{prefix}"]').all():
            ai_id = element.get_attribute("data-ai-id") or ""
            suffix = ai_id[len(prefix):]
            parts = suffix.split(":")
            if len(parts) == 2 and all(parts):
                out.append(suffix)
        return out

    def resource_chart(self, group: str, key: str) -> Locator:
        return self.chart(self.resource_chart_id(group, key))

    def resource_chart_empty(self, group: str, key: str) -> Locator:
        return self.chart_empty(self.resource_chart_id(group, key))

    def resource_chart_series(self, group: str, key: str) -> list[str]:
        return self.chart_series_ids(self.resource_chart_id(group, key))

    def resource_chart_legend(self, group: str, key: str) -> Locator:
        return self.chart_legend(self.resource_chart_id(group, key))

    def resource_chart_legend_items(self, group: str, key: str) -> list[str]:
        return self.chart_legend_items(self.resource_chart_id(group, key))

    def resource_legend_value(self, group: str, key: str, series_key: str) -> str:
        return self.chart_legend_value(self.resource_chart_id(group, key), series_key)

    def resource_charts_in_group(self, group: str) -> list[str]:
        """`<key>` of every chart whose container sits inside the group's section."""
        prefix = "cluster-monitor:resource:chart:" + group + ":"
        out: list[str] = []
        for element in self.resource_group(group).locator('[data-ai-id^="cluster-monitor:resource:chart:"]').all():
            ai_id = element.get_attribute("data-ai-id") or ""
            if not ai_id.startswith(prefix):
                continue
            key = ai_id[len(prefix):]
            if key and ":" not in key:
                out.append(key)
        return out

    # ---------------- API Server / 调度器页签（契约 §6） ----------------

    APISERVER_CHARTS = ("latency", "rate")
    SCHEDULER_CHARTS = ("attempts", "rate", "latency")

    def _panel_chart_ids(self, prefix: str) -> list[str]:
        return self._row_ids(prefix)

    def apiserver_chart_ids(self) -> list[str]:
        return self._panel_chart_ids("cluster-monitor:apiserver:chart:")

    def apiserver_chart(self, key: str) -> Locator:
        return self.chart(f"cluster-monitor:apiserver:chart:{key}")

    def apiserver_chart_empty(self, key: str) -> Locator:
        return self.chart_empty(f"cluster-monitor:apiserver:chart:{key}")

    def apiserver_chart_series(self, key: str) -> list[str]:
        return self.chart_series_ids(f"cluster-monitor:apiserver:chart:{key}")

    def apiserver_chart_legend_items(self, key: str) -> list[str]:
        return self.chart_legend_items(f"cluster-monitor:apiserver:chart:{key}")

    def apiserver_legend_value(self, key: str, series_key: str) -> str:
        return self.chart_legend_value(f"cluster-monitor:apiserver:chart:{key}", series_key)

    def scheduler_chart_ids(self) -> list[str]:
        return self._panel_chart_ids("cluster-monitor:scheduler:chart:")

    def scheduler_chart(self, key: str) -> Locator:
        return self.chart(f"cluster-monitor:scheduler:chart:{key}")

    def scheduler_chart_empty(self, key: str) -> Locator:
        return self.chart_empty(f"cluster-monitor:scheduler:chart:{key}")

    def scheduler_chart_series(self, key: str) -> list[str]:
        return self.chart_series_ids(f"cluster-monitor:scheduler:chart:{key}")

    def scheduler_chart_legend_items(self, key: str) -> list[str]:
        return self.chart_legend_items(f"cluster-monitor:scheduler:chart:{key}")

    def scheduler_legend_value(self, key: str, series_key: str) -> str:
        return self.chart_legend_value(f"cluster-monitor:scheduler:chart:{key}", series_key)

    # ---------------- 条件 etcd 页签（Lead A-variant，本部署 404 时隐藏） ----------------

    def etcd_tab(self) -> Locator:
        return self.tab("etcd")

    def etcd_tabpanel(self) -> Locator:
        return self.tabpanel("etcd")

    def etcd_no_data(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:etcd:no-data"]').last

    def etcd_retry(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:etcd:retry"]').last

    def etcd_chart_ids(self) -> list[str]:
        return self._row_ids("cluster-monitor:etcd:chart:")

    def etcd_chart(self, key: str) -> Locator:
        return self.chart(f"cluster-monitor:etcd:chart:{key}")

    # ---------------- 排行页签 + 导出（契约 §7） ----------------

    def ranking_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:ranking:surface"]').last

    def ranking_export(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:ranking:export"]').last

    def ranking_metric_select(self) -> Locator:
        return self.page.locator('[data-ai-id="cluster-monitor:ranking:metric"]').last

    def ranking_row_names(self) -> list[str]:
        """Node names in the ranking table, in render order."""
        return [
            element.get_attribute("data-ai-row") or ""
            for element in self.page.locator('[data-ai-id="cluster-monitor:ranking:surface"] [data-ai-row]').all()
        ]

    def ranking_value_text(self, metric: str, name: str) -> str:
        return self.page.locator(f'[data-ai-id="cluster-monitor:ranking:{metric}:{name}"]').last.inner_text().strip()

    # ---------------- 排行数据（与页面同源的 API 读取） ----------------

    NODE_RANK_METRICS = (
        "node_gpu_memory_utilisation", "node_gpu_utilisation", "node_gpu_allocated",
        "node_cpu_utilisation", "node_load1", "node_memory_utilisation",
        "node_disk_size_utilisation", "node_disk_inode_utilisation", "node_pod_utilisation",
    )
    _NODE_RANK_EXTRA = ("node_gpu_total", "node_pod_running_count")

    def _nodes_rank_path(self) -> str:
        if self.cluster == "host":
            return "/kapis/monitoring.kubesphere.io/v1alpha3/nodes"
        return f"/kapis/clusters/{self.cluster}/monitoring.kubesphere.io/v1alpha3/nodes"

    def node_ranking(
        self,
        metric: str = "node_cpu_utilisation",
        order: str = "desc",
        page: int = 1,
        page_size: int = -1,
        keyword: str = "",
    ) -> dict[str, Any]:
        """GET the node ranking the page reads (type=rank), all rows by default."""
        assert self.api is not None, "api client required"
        metrics = "|".join(f"{name}$" for name in (*self.NODE_RANK_METRICS, *self._NODE_RANK_EXTRA))
        query = (
            f"type=rank&sort_metric={metric}&sort_type={order}&page={page}&limit={page_size}"
            f"&metrics_filter={metrics}"
        )
        if keyword:
            query += f"&resources_filter={keyword}"
        status, body = self.api.request("GET", f"{self._nodes_rank_path()}?{query}")
        assert status == 200, f"nodes rank -> {status}: {str(body)[:200]}"
        return body

    def node_ranking_rows(
        self,
        metric: str = "node_cpu_utilisation",
        order: str = "desc",
        page_size: int = 100,
    ) -> list[dict[str, Any]]:
        """Every ranking row in API order: [{'name': str, 'values': {...}}].

        Pages like the export does: the monitoring handler rejects `limit=-1`
        with HTTP 400, so "all rows" means "page until total".
        """
        rows: dict[str, dict[str, float]] = {}
        order_names: list[str] = []
        total = 0
        page = 1
        while page <= 100:
            body = self.node_ranking(metric=metric, order=order, page=page, page_size=page_size)
            if page == 1:
                total = int(body.get("total_item") or 0)
                order_names = [
                    str((sample.get("metric") or {}).get("node"))
                    for sample in (
                        next(
                            (
                                result
                                for result in body.get("results") or []
                                if result.get("metric_name") == metric
                            ),
                            {},
                        ).get("data") or {}
                    ).get("result") or []
                    if (sample.get("metric") or {}).get("node")
                ]
            page_rows = 0
            for result in body.get("results") or []:
                name = result.get("metric_name")
                if not name:
                    continue
                for sample in (result.get("data") or {}).get("result") or []:
                    node = (sample.get("metric") or {}).get("node")
                    value = (sample.get("value") or [None, None])[1]
                    if not node or value in (None, ""):
                        continue
                    page_rows += 1
                    try:
                        rows.setdefault(str(node), {})[str(name)] = float(value)
                    except (TypeError, ValueError):
                        continue
            if total and len(rows) >= total:
                break
            if page_rows == 0:
                break
            page += 1
        ordered = [name for name in order_names if name in rows]
        ordered += [name for name in rows if name not in ordered]
        return [{"name": name, "values": rows[name]} for name in ordered]