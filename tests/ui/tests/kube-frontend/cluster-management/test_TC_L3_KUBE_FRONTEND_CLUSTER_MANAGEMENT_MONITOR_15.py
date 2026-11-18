from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: Only the scheduler component: the 500 branch also asserts the API Server tab stays
#: usable, so the interception must not blank both components.
SCHEDULER = "**/monitoring.kubesphere.io/v1alpha3/components/scheduler**"

ATTEMPTS_METRICS = ("scheduler_schedule_attempts",)
RATE_METRICS = ("scheduler_schedule_attempt_rate",)
LATENCY_METRICS = ("scheduler_e2e_scheduling_latency_quantile", "scheduler_e2e_scheduling_latency")


def _finite(values) -> bool:
    return bool(values) and any(value == value and abs(value) != float("inf") for value in values)


def _identities(series: dict, metrics, label: str) -> set[str]:
    found: set[str] = set()
    for metric in metrics:
        for labels, values in series.get(metric) or []:
            value = (labels or {}).get(label)
            if value and _finite(values):
                found.add(str(value))
    return found


def _has_retry(panel) -> bool:
    return panel.locator('[data-ai-id$=":retry"]').count() > 0


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_15(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-15 集群监控调度器页签：调度尝试/速率（按 result）与延迟图。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    series = ui.component_series(
        "scheduler",
        [*ATTEMPTS_METRICS, *RATE_METRICS, *LATENCY_METRICS],
        window_seconds=3600,
        step="60s",
    )
    attempt_results = _identities(series, ATTEMPTS_METRICS, "result")
    rate_results = _identities(series, RATE_METRICS, "result")
    quantiles = _identities(series, LATENCY_METRICS, "quantile")
    latency_average = any(_finite(values) for _labels, values in series.get("scheduler_e2e_scheduling_latency") or [])

    ui.open("scheduler")
    ui.wait_ready()
    expect(ui.tabpanel("scheduler")).to_be_visible(timeout=30_000)

    # ---- three charts, in contract order ----
    assert ui.scheduler_chart_ids() == ["attempts", "rate", "latency"], ui.scheduler_chart_ids()
    for key in ("attempts", "rate", "latency"):
        expect(ui.scheduler_chart(key)).to_be_visible(timeout=30_000)

    # ---- attempts and rate are one line per result identity ----
    expected_results = {"attempts": attempt_results, "rate": rate_results}
    for key in ("attempts", "rate"):
        results = expected_results[key]
        empty = ui.scheduler_chart_empty(key)
        if empty.count() > 0:
            assert empty.inner_text().strip(), f"{key} 空态缺说明"
            assert ui.scheduler_chart(key).locator("path[data-ai-trend-line]").count() == 0, (
                f"{key} 无数据时不应画零线"
            )
            continue
        lines = ui.scheduler_chart_series(key)
        assert len(lines) >= 1, f"{key} 没有画出曲线"
        if results:
            assert len(lines) == len(results), f"{key} 画了 {len(lines)} 条线，接口有 result 身份 {sorted(results)}"
            assert len(set(lines)) == len(lines), f"{key} 有重复身份: {lines}"
            legend_text = ui.page.locator(f'[data-ai-id="cluster-monitor:scheduler:chart:{key}:legend"]').inner_text()
            for result in sorted(results):
                assert result in legend_text or any(result in line for line in lines), (
                    f"{key} 图例/系列缺 result {result}: {legend_text!r}"
                )

    # ---- units: attempts is a cumulative count, rate is per second ----
    if ui.scheduler_chart_empty("attempts").count() == 0:
        attempts_text = ui.scheduler_chart("attempts").inner_text()
        assert re.search(r"\b\d+\b", attempts_text), f"调度尝试次数应为整数: {attempts_text[:160]!r}"
    if ui.scheduler_chart_empty("rate").count() == 0:
        rate_text = ui.scheduler_chart("rate").inner_text()
        assert "次/秒" in rate_text or "/s" in rate_text, f"调度尝试速率应以次/秒显示: {rate_text[:160]!r}"

    # ---- latency: average + quantiles in ms, or an explicit empty state (no series here) ----
    latency_empty = ui.scheduler_chart_empty("latency")
    if latency_empty.count() > 0:
        assert latency_empty.inner_text().strip(), "调度延迟空态缺说明"
        assert ui.scheduler_chart("latency").locator("path[data-ai-trend-line]").count() == 0, (
            "调度延迟无序列时不应画零线"
        )
    else:
        latency_lines = ui.scheduler_chart_series("latency")
        assert len(latency_lines) >= 1, "调度延迟图没有曲线"
        assert "ms" in ui.scheduler_chart("latency").inner_text(), "调度延迟应以 ms 显示"
        expected_latency_lines = len(quantiles) + (1 if latency_average else 0)
        assert len(latency_lines) == expected_latency_lines, (
            f"延迟图 {latency_lines} 条 vs 「平均 + {sorted(quantiles)}」共 {expected_latency_lines} 条"
        )

    screenshot(ui.page, "cluster-monitor-scheduler")

    # ---- 403: permission without a retry button ----
    ui.page.route(SCHEDULER, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    try:
        ui.open("scheduler")
        ui.wait_ready()
        panel = ui.tabpanel("scheduler")
        expect(panel.locator('[data-ai-id="resource-error"]').first).to_be_visible(timeout=30_000)
        assert "无权限" in panel.inner_text() or "权限" in panel.inner_text(), panel.inner_text()[:200]
        assert not _has_retry(panel), "403 时不应提供重试按钮"
    finally:
        ui.page.unroute(SCHEDULER)

    # ---- 500: error + retry; apiserver tab is an independent query ----
    ui.page.route(SCHEDULER, lambda route: route.fulfill(status=500, json={"message": "scheduler unavailable"}))
    try:
        ui.open("scheduler")
        ui.wait_ready()
        panel = ui.tabpanel("scheduler")
        expect(panel.locator('[data-ai-id="resource-error"]').first).to_be_visible(timeout=30_000)
        assert panel.locator('[data-ai-id$=":retry"]').count() == 1, "500 时应提供重试按钮"

        ui.select_tab("apiserver")
        ui.wait_ready()
        assert sorted(ui.apiserver_chart_ids()) == ["latency", "rate"], "scheduler 失败不应让 apiserver 页签消失"
        expect(ui.apiserver_chart("latency")).to_be_visible(timeout=30_000)
    finally:
        ui.page.unroute(SCHEDULER)

    # ---- removing the failure recovers ----
    ui.open("scheduler")
    ui.wait_ready()
    expect(ui.scheduler_chart("attempts")).to_be_visible(timeout=30_000)
    screenshot(ui.page, "cluster-monitor-scheduler-restored")