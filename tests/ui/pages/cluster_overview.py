"""页面对象：kube-frontend 的集群概览。

集群概览是集群作用域的落地页：地址是 `/kube-frontend/clusters/<id>/overview`，
没有 workspace 也没有 namespace 段，页面顶部没有项目工作区栏。

这一页读两份互不依赖的数据：

- 集群对象（`cluster.kubesphere.io`）—— 静态事实：版本、就绪、模块开关；
- KubeSphere 监控 API —— 随时间变化的测量值。

测试据此分别对账：静态字段必须与集群对象逐项一致；测量值只断言「形状」与
「单位自洽」（已用 / 总量 / 百分比三者同源），因为把数值写死等于断言采样时刻。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, expect

CLUSTER_OBJECT = "/kapis/cluster.kubesphere.io/v1alpha1/clusters"
METRICS_CLUSTER = "/kapis/monitoring.kubesphere.io/v1alpha3/cluster"


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class ClusterOverviewPage:
    """集群概览页。"""

    #: Fields rendered in 基本信息, keyed by the ai handle suffix.
    BASIC_FIELDS = (
        "status",
        "provider",
        "kubernetes-version",
        "kubesphere-version",
        "node-count",
        "connection",
        "api-endpoint",
    )

    #: Usage rows always present; the GPU row only appears on a cluster that has GPUs.
    USAGE_ROWS = ("cpu", "memory", "pods", "nodes")

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        api: ApiLike | None = None,
    ) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.cluster = cluster
        self.api = api

    # ---------------- 结构 ----------------

    @property
    def url(self) -> str:
        return f"{self.base_url}/kube-frontend/clusters/{self.cluster}/overview"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="overview:surface"]').last

    def open(self) -> None:
        self.page.goto(self.url)
        try:
            expect(self.surface).to_be_visible(timeout=30_000)
        except AssertionError:
            # One reload: the first paint occasionally loses the race against a slow
            # cluster object read. Never retried for a rendered error page.
            self.page.goto(self.url)
            expect(self.surface).to_be_visible(timeout=60_000)

    def wait_ready(self, timeout_ms: int = 120_000) -> None:
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def field(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="overview:{name}"]').last

    def field_text(self, name: str) -> str:
        return self.field(name).inner_text().strip()

    def usage_row(self, name: str) -> Locator:
        return self.page.locator(f'[data-ai-id="overview:usage-{name}"]').last

    def usage_text(self, name: str) -> str:
        return self.usage_row(name).inner_text().strip()

    @property
    def status_row(self) -> str:
        return self.field_text("status")

    @property
    def workspace_bar_count(self) -> int:
        """Cluster-scoped pages must render none of these."""
        return self.page.locator('[data-ai-id="workspace-bar"]').count()

    # ---------------- 模块区 ----------------

    def enabled_modules(self) -> list[str]:
        """Module badges in the 已启用 group, as rendered text."""
        return [
            value.strip()
            for value in self.page.locator('[data-ai-id="overview:modules"] li').all_inner_texts()
            if value.strip()
        ]

    def missing_section(self) -> str:
        """The 未安装 (N) line, plus its entries, as one string."""
        panel = self.page.locator('section:has([data-ai-id="overview:modules"])').last
        return panel.inner_text()

    def metrics_unavailable(self) -> bool:
        return self.page.locator('[data-ai-id="overview:no-metrics"]').count() > 0

    def kubernetes_status_fields(self) -> list[str]:
        """The four control-plane numbers, as rendered text."""
        return [
            self.page.locator(f'[data-ai-id="overview:{name}"]').last.inner_text().strip()
            for name in ("request-rate", "request-latency", "scheduled", "unschedulable")
        ]

    # ---------------- 数据 ----------------

    def cluster_object(self) -> dict[str, Any] | None:
        assert self.api is not None, "api client required"
        status, body = self.api.request("GET", f"{CLUSTER_OBJECT}/{self.cluster}")
        if status != 200 or not isinstance(body, dict):
            return None
        return body

    def cluster_metrics(self) -> dict[str, str] | None:
        """Metric name → raw sample string, or None when monitoring is unavailable."""
        assert self.api is not None, "api client required"
        names = [
            "cluster_cpu_usage",
            "cluster_cpu_total",
            "cluster_cpu_allocated",
            "cluster_memory_usage_wo_cache",
            "cluster_memory_total",
            "cluster_pod_running_count",
            "cluster_pod_quota",
            "cluster_node_online",
            "cluster_node_total",
            "cluster_gpu_allocated",
            "cluster_gpu_total",
        ]
        metrics_filter = "|".join(f"{name}$" for name in names)
        status, body = self.api.request(
            "GET",
            f"{METRICS_CLUSTER}?cluster={self.cluster}&metrics_filter={metrics_filter}",
        )
        if status != 200 or not isinstance(body, dict):
            return None
        out: dict[str, str] = {}
        for result in body.get("results") or []:
            name = result.get("metric_name")
            samples = ((result.get("data") or {}).get("result")) or []
            if not name or not samples:
                continue
            out[str(name)] = str(samples[0].get("value", [None, ""])[1])
        return out or None

    def enabled_module_keys(self) -> list[str]:
        """Module keys the cluster object reports as installed."""
        cluster = self.cluster_object() or {}
        configz = ((cluster.get("status") or {}).get("configz")) or {}
        return sorted(key for key, value in configz.items() if value is True)

    def missing_module_keys(self) -> list[str]:
        cluster = self.cluster_object() or {}
        configz = ((cluster.get("status") or {}).get("configz")) or {}
        return sorted(key for key, value in configz.items() if value is not True)
