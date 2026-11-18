from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: Only the API Server component: the 500 branch also asserts the scheduler tab stays
#: usable, so the interception must not blank both components.
APISERVER = "**/monitoring.kubesphere.io/v1alpha3/components/apiserver**"

#: The metrics each chart carries (see componentMonitorQueries.ts).
LATENCY_METRICS = ("apiserver_request_by_verb_latencies", "apiserver_request_latencies")
RATE_METRICS = ("apiserver_request_rate", "apiserver_request_by_verb_rate")

VERB_RE = re.compile(r"\b(GET|POST|PUT|PATCH|DELETE|LIST|WATCH|CONNECT|HEAD|OPTIONS|APPLY)\b")


def _finite(values) -> bool:
    return bool(values) and any(value == value and abs(value) != float("inf") for value in values)


def _expected_verbs(series: dict, metrics) -> set[str]:
    """The verb identities that actually carry finite values."""
    verbs: set[str] = set()
    for metric in metrics:
        for labels, values in series.get(metric) or []:
            verb = (labels or {}).get("verb")
            if verb and _finite(values):
                verbs.add(str(verb).upper())
    return verbs


def _has_retry(panel) -> bool:
    return panel.locator('[data-ai-id$=":retry"]').count() > 0


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_14(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-14 集群监控 API Server 页签：延迟（总均 + 按 verb）与请求速率大图。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    series = ui.component_series("apiserver", [*LATENCY_METRICS, *RATE_METRICS], window_seconds=3600, step="60s")
    latency_verbs = _expected_verbs(series, ("apiserver_request_by_verb_latencies",))

    ui.open("apiserver")
    ui.wait_ready()
    expect(ui.tabpanel("apiserver")).to_be_visible(timeout=30_000)

    # ---- both charts exist and, with data, draw lines with a legend ----
    assert sorted(ui.apiserver_chart_ids()) == ["latency", "rate"], ui.apiserver_chart_ids()
    for key in ("latency", "rate"):
        expect(ui.apiserver_chart(key)).to_be_visible(timeout=30_000)
        draw = ui.apiserver_chart(key).locator("path[data-ai-trend-line]").count()
        has_empty = ui.apiserver_chart_empty(key).count() > 0
        if has_empty:
            assert ui.apiserver_chart_empty(key).inner_text().strip(), f"{key} 空态缺说明"
            assert draw == 0, f"{key} 无数据时不应画零线"
            continue
        assert draw > 0, f"{key} 没有画出曲线"
        legend = ui.page.locator(f'[data-ai-id="cluster-monitor:apiserver:chart:{key}:legend"]')
        assert legend.count() == 1, f"{key} 缺图例"
        assert legend.inner_text().strip(), f"{key} 图例为空"

    # ---- latency is per verb: one line per verb identity, never merged ----
    latency_lines = ui.apiserver_chart_series("latency")
    has_latency = ui.apiserver_chart_empty("latency").count() == 0
    if has_latency:
        # total average is one of the lines; every verb with data is another.
        expected_lines = len(latency_verbs) + (1 if latency_lines else 0)
        assert len(latency_lines) >= len(latency_verbs) + 1, (
            f"延迟图 {latency_lines} 少于「平均 + {sorted(latency_verbs)}」的 {len(latency_verbs) + 1} 条"
        )
        legend_text = ui.page.locator('[data-ai-id="cluster-monitor:apiserver:chart:latency:legend"]').inner_text()
        for verb in sorted(latency_verbs):
            assert verb in legend_text or any(verb in line for line in latency_lines), (
                f"延迟图例/系列缺 verb {verb}: {legend_text!r} / {latency_lines}"
            )
        assert len(set(latency_lines)) == len(latency_lines), f"延迟图有重复身份: {latency_lines}"
        # Seconds ×1000 → ms. The legend/axis text is where the unit is printed.
        latency_text = ui.apiserver_chart("latency").inner_text()
        assert "ms" in latency_text, f"延迟应以 ms 显示: {latency_text[:160]!r}"

    # ---- rate is requests per second ----
    rate_text = ui.apiserver_chart("rate").inner_text()
    if ui.apiserver_chart_empty("rate").count() == 0:
        assert "次/秒" in rate_text or "/s" in rate_text, f"请求速率应以次/秒显示: {rate_text[:160]!r}"

    screenshot(ui.page, "cluster-monitor-apiserver")

    # ---- 403: permission on this tab, no retry button ----
    ui.page.route(APISERVER, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    try:
        ui.open("apiserver")
        ui.wait_ready()
        panel = ui.tabpanel("apiserver")
        expect(panel.locator('[data-ai-id="resource-error"]').first).to_be_visible(timeout=30_000)
        assert "无权限" in panel.inner_text() or "权限" in panel.inner_text(), panel.inner_text()[:200]
        assert not _has_retry(panel), "403 时不应提供重试按钮"
    finally:
        ui.page.unroute(APISERVER)

    # ---- 500: error + retry, and the other component tab stays usable ----
    requests: list[str] = []

    def unavailable(route):
        requests.append(route.request.url)
        route.fulfill(status=500, json={"message": "components unavailable"})

    ui.page.route(APISERVER, unavailable)
    try:
        ui.open("apiserver")
        ui.wait_ready()
        panel = ui.tabpanel("apiserver")
        expect(panel.locator('[data-ai-id="resource-error"]').first).to_be_visible(timeout=30_000)
        retry = panel.locator('[data-ai-id$=":retry"]')
        assert retry.count() == 1, "500 时应提供重试按钮"
        before = len([url for url in requests if "/components/apiserver" in url])
        retry.first.click()
        deadline = 30
        while deadline > 0 and len([url for url in requests if "/components/apiserver" in url]) <= before:
            ui.page.wait_for_timeout(200)
            deadline -= 1
        assert len([url for url in requests if "/components/apiserver" in url]) > before, "点重试后没有重新请求 apiserver"

        # The scheduler tab owns its own query: a broken apiserver must not blank it.
        ui.select_tab("scheduler")
        ui.wait_ready()
        assert ui.scheduler_chart_ids(), ui.scheduler_chart_ids()
        expect(ui.scheduler_chart("attempts")).to_be_visible(timeout=30_000)
    finally:
        ui.page.unroute(APISERVER)

    # ---- removing the failure recovers on retry ----
    ui.open("apiserver")
    ui.wait_ready()
    expect(ui.apiserver_chart("latency")).to_be_visible(timeout=30_000)
    assert ui.apiserver_chart_empty("latency").count() == 0 or ui.apiserver_chart("latency").is_visible()
    screenshot(ui.page, "cluster-monitor-apiserver-restored")