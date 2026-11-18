from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

APISERVER_METRICS = [
    "apiserver_request_rate",
    "apiserver_request_by_verb_rate",
    "apiserver_request_latencies",
    "apiserver_request_by_verb_latencies",
]
APISERVER_COMPONENT = "**/monitoring.kubesphere.io/v1alpha3/components/apiserver**"
SCHEDULER_METRICS = [
    "scheduler_schedule_attempts",
    "scheduler_schedule_attempt_rate",
    "scheduler_e2e_scheduling_latency",
    "scheduler_e2e_scheduling_latency_quantile",
]

MS = re.compile(r"^(\d+(?:\.\d+)?) ms$")
PER_SECOND = re.compile(r"^(\d+\.\d{2}) (?:次/秒|req/s)$")
INTEGER = re.compile(r"^\d+$")


def _number(text: str) -> float:
    match = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    assert match, f"没有数字: {text!r}"
    return float(match.group(0))


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_06(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-06 集群监控：系统组件 APIServer/Scheduler 多序列、身份与单位。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    # ---- API Server tab: latency (total average + one line per verb) and request rate ----
    apiserver = ui.component_series("apiserver", APISERVER_METRICS)
    finite_verb_latencies = {
        str(labels.get("verb")): values
        for labels, values in apiserver.get("apiserver_request_by_verb_latencies") or []
        if labels.get("verb") and values
    }

    ui.open("apiserver")
    ui.wait_ready()
    expect(ui.tabpanel("apiserver")).to_be_visible(timeout=30_000)

    assert sorted(ui.apiserver_chart_ids()) == ["latency", "rate"], ui.apiserver_chart_ids()
    expect(ui.apiserver_chart("latency")).to_be_visible(timeout=30_000)
    expect(ui.apiserver_chart("rate")).to_be_visible(timeout=30_000)

    latency_lines = ui.apiserver_chart_series("latency")
    if finite_verb_latencies:
        assert latency_lines, "延迟图没有画出任何序列"
        rendered_verbs = {line[len("verb:"):] for line in latency_lines if line.startswith("verb:")}
        assert rendered_verbs, f"按 verb 的延迟一条线都没有: {latency_lines}"
        # A NaN-only identity (APPLY) draws no line, so every drawn verb must have finite values.
        assert rendered_verbs <= set(finite_verb_latencies), rendered_verbs - set(finite_verb_latencies)
        assert "apiserver_request_latencies" in latency_lines, "总平均没有单独成线"
        assert len(latency_lines) == len(rendered_verbs) + 1, (latency_lines, finite_verb_latencies)
        assert len(set(latency_lines)) == len(latency_lines), f"身份被合并或重复: {latency_lines}"

        get_values = finite_verb_latencies["GET"]
        shown_get = MS.match(ui.apiserver_legend_value("latency", "verb:GET"))
        assert shown_get, ui.apiserver_legend_value("latency", "verb:GET")
        expected_get = get_values[-1] * 1000
        assert float(shown_get.group(1)) > 0
        assert abs(float(shown_get.group(1)) - expected_get) / expected_get < 5, (
            f"GET 延迟 {shown_get.group(1)}ms 与接口 {expected_get:.2f}ms 数量级不符"
        )

    rate_value = ui.apiserver_legend_value("rate", "apiserver_request_rate")
    assert PER_SECOND.match(rate_value), f"请求速率应为次/秒两位小数: {rate_value!r}"

    # ---- scheduler tab: attempts / rate by result, latency empty in this deployment ----
    scheduler = ui.component_series("scheduler", SCHEDULER_METRICS)
    attempts = {
        str(labels.get("result")): values
        for labels, values in scheduler.get("scheduler_schedule_attempts") or []
        if labels.get("result") and values
    }
    ui.select_tab("scheduler")
    ui.wait_ready()
    expect(ui.tabpanel("scheduler")).to_be_visible(timeout=30_000)
    assert ui.scheduler_chart_ids() == ["attempts", "rate", "latency"], ui.scheduler_chart_ids()

    if attempts:
        # The backend reports the result identities that exist; this deployment has no
        # "error" series at all. A missing identity must not be drawn as a zero line.
        assert set(attempts) <= {"scheduled", "error", "unschedulable"}, attempts
        rendered_attempt_lines = ui.scheduler_chart_series("attempts")
        assert set(rendered_attempt_lines) == {f"result:{result}" for result in attempts}, (
            f"attempts 线 {rendered_attempt_lines} vs 接口身份 {sorted(attempts)}"
        )
        for result, values in attempts.items():
            value = ui.scheduler_legend_value("attempts", f"result:{result}")
            assert INTEGER.match(value), f"调度尝试次数应为整数: {value!r}"
            shown = float(value)
            assert values[0] - 20 <= shown <= values[-1] + 20, (result, shown, values[0], values[-1])
        visible_results = list(attempts)
        rate_result = "scheduled" if "scheduled" in attempts else visible_results[0]
        attempt_rate = ui.scheduler_legend_value("rate", f"result:{rate_result}")
        assert PER_SECOND.match(attempt_rate), f"调度尝试速率应为次/秒两位小数: {attempt_rate!r}"
    else:
        assert ui.scheduler_chart_empty("attempts").inner_text().strip(), "调度尝试无序列时应给空态说明"

    # This deployment reports no scheduling-latency samples: explanation, never a zero line.
    assert ui.scheduler_chart_empty("latency").count() == 1, "调度延迟无序列时应渲染 :empty"
    assert ui.scheduler_chart_empty("latency").inner_text().strip()
    assert ui.scheduler_chart("latency").locator("path[data-ai-trend-line]").count() == 0, (
        "调度延迟无序列时不应画零线"
    )

    # ---- NaN-only identities draw no zero line: mock one APPLY series ----
    now = int(time.time())
    finite_samples = [[now - 120, "0.003"], [now - 60, "0.004"]]

    def apiserver_with_nan(route):
        route.fulfill(json={"results": [
            {"metric_name": "apiserver_request_by_verb_latencies", "data": {"resultType": "matrix", "result": [
                {"metric": {"__name__": "x", "verb": "APPLY"}, "values": [[now - 120, "NaN"], [now - 60, "NaN"]]},
                {"metric": {"__name__": "x", "verb": "GET"}, "values": finite_samples},
            ]}},
            {"metric_name": "apiserver_request_latencies", "data": {"resultType": "matrix", "result": [
                {"metric": {"__name__": "y"}, "values": finite_samples},
            ]}},
        ]})

    ui.page.route(APISERVER_COMPONENT, apiserver_with_nan)
    try:
        ui.select_tab("apiserver")
        ui.wait_ready()
        ui.select_range("6h")
        expect(ui.tabpanel("apiserver")).to_be_visible(timeout=30_000)
        mocked: list[str] = []
        deadline = time.time() + 30
        while time.time() < deadline:
            mocked = ui.apiserver_chart_series("latency")
            if "verb:GET" in mocked:
                break
            ui.page.wait_for_timeout(250)
        assert set(mocked) == {"verb:GET", "apiserver_request_latencies"}, mocked
        assert ui.apiserver_legend_value("latency", "verb:GET") == "4.00 ms", ui.apiserver_legend_value("latency", "verb:GET")
    finally:
        ui.page.unroute(APISERVER_COMPONENT)
        ui.select_range("1h")
        ui.wait_ready()

    # ---- etcd (conditional 6th tab) is not part of this deployment's strip ----
    assert ui.page.locator('[data-ai-id="cluster-monitor:tab:etcd"]').count() == 0

    screenshot(ui.page, "cluster-monitor-components")