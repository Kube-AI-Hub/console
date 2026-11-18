from __future__ import annotations

import json
import re
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SYSTEM_NAMESPACE = "kubesphere-system"
#: 容器级监控：容器在路径里，不是查询参数。
MONITOR_GLOB = "**/monitoring.kubesphere.io/v1alpha3/namespaces/*/pods/*/containers/*"
METRICS = (
    "container_gpu_usage",
    "container_gpu_memory_usage",
    "container_cpu_usage",
    "container_memory_usage_wo_cache",
)
CARDS = ("gpu", "gpu-memory", "cpu", "memory")


def _pods(ui, namespace: str) -> list[dict]:
    status, body = ui._request("GET", f"/api/v1/namespaces/{namespace}/pods?limit=200")
    assert status == 200 and isinstance(body, dict), f"读取 {namespace} 容器组失败：HTTP {status} — {repr(body)[:200]}"
    return list(body.get("items") or [])


def _pod_with_container(ui) -> tuple[str, str, str]:
    for namespace in ("default", SYSTEM_NAMESPACE):
        for item in _pods(ui, namespace):
            containers = (item.get("spec") or {}).get("containers") or []
            name = str((item.get("metadata") or {}).get("name") or "")
            if containers and name:
                return namespace, name, str(containers[0].get("name"))
    raise AssertionError("集群里没有带容器的容器组，无法打开容器监控")


def _url(ui, namespace: str, pod: str, container: str) -> str:
    origin = ui.base.split("/kube-frontend/")[0]
    return f"{origin}/kube-frontend/{ui.workspace}/clusters/{ui.cluster}/projects/{namespace}/pods/{pod}/containers/{container}"


def _open_monitor(ui, url: str):
    """Load the container page and open 监控; returns the settled panel locator."""
    ui.page.goto(url)
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    trigger = ui.page.locator('[data-ai-id="container-detail:tab-trigger:monitor"]')
    expect(trigger).to_be_visible(timeout=20_000)
    trigger.click()
    expect(ui.page.locator('[data-ai-id="container-detail:tab:monitor"]')).to_be_visible(timeout=20_000)
    panel = ui.page.locator('[data-ai-id="container-detail:monitor"]')
    expect(panel).to_be_visible(timeout=30_000)
    # Exactly one of loading / ready / empty / error; wait for it to settle.
    expect(panel).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    return panel


def _zero_matrix() -> str:
    """A synthetic answer with real samples whose values are all 0."""
    now = int(time.time())
    results = [
        {
            "metric_name": metric,
            "data": {
                "resultType": "matrix",
                "result": [{"metric": {}, "values": [[now - 60, "0"], [now, "0"]]}],
            },
        }
        for metric in METRICS
    ]
    return json.dumps({"results": results})


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_07(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-07 容器详情：监控页签。"""

    ui = app_workloads_page
    assert ui.api is not None

    namespace, pod, container = _pod_with_container(ui)
    url = _url(ui, namespace, pod, container)

    # ---- real answer: charts when the cluster has container series, empty otherwise ----
    panel = _open_monitor(ui, url)
    empty = panel.locator('[data-ai-id="container-detail:monitor:empty"]')
    chart = panel.locator('[data-ai-id="container-detail:monitor:chart"]')

    # The three window buttons exist regardless of the data.
    for window in ("1h", "6h", "24h"):
        expect(ui.page.locator(f'[data-ai-id="container-detail:monitor:window:{window}"]')).to_be_visible(
            timeout=20_000
        )
    expect(ui.page.locator('[data-ai-id="container-detail:monitor:window:1h"]')).to_have_attribute(
        "aria-pressed", "true"
    )

    if empty.count() > 0:
        # This deployment's cAdvisor series carry no container/image labels, so the
        # backend template's container!="" / image!="" filters drop every container-level
        # series (measured on mlu370; the old console answers empty here too). The empty
        # state IS the correct product behaviour for this environment — not a skip.
        expect(empty).to_be_visible()
        assert "该时间窗没有数据" in empty.inner_text(), empty.inner_text()
    else:
        expect(chart).to_be_visible(timeout=60_000)
        points = int(chart.get_attribute("data-ai-points") or 0)
        assert points > 0, "有采样点时 data-ai-points 应大于 0"
        for card in CARDS:
            expect(ui.page.locator(f'[data-ai-id="container-detail:monitor:{card}"]')).to_be_visible()
        assert chart.locator("svg path[data-ai-trend-line]").count() > 0, "有采样点却没有趋势路径"
    screenshot(ui.page, "container-detail-monitor")

    # ---- window switching refetches, and the pressed state follows ----
    six_hours = ui.page.locator('[data-ai-id="container-detail:monitor:window:6h"]')
    with ui.page.expect_response(lambda response: "monitoring.kubesphere.io" in response.url, timeout=90_000):
        six_hours.click()
    expect(six_hours).to_have_attribute("aria-pressed", "true")
    expect(ui.page.locator('[data-ai-id="container-detail:monitor:window:1h"]')).to_have_attribute(
        "aria-pressed", "false"
    )
    expect(ui.page.locator('[data-ai-id="container-detail:monitor"]')).not_to_have_attribute(
        "data-ai-state", "loading", timeout=90_000
    )
    if chart.count() > 0:
        expect(chart).to_have_attribute("data-ai-window", "6h", timeout=90_000)
        day = ui.page.locator('[data-ai-id="container-detail:monitor:window:24h"]')
        with ui.page.expect_response(lambda response: "monitoring.kubesphere.io" in response.url, timeout=90_000):
            day.click()
        expect(day).to_have_attribute("aria-pressed", "true")
        expect(chart).to_have_attribute("data-ai-window", "24h", timeout=90_000)

    # ---- request failure: 监控不可用 + retry, and no empty state pretending otherwise ----
    ui.page.route(MONITOR_GLOB, lambda route: route.fulfill(status=500, content_type="application/json", body="{}"))
    try:
        panel = _open_monitor(ui, url)
        error = panel.locator('[data-ai-id="container-detail:monitor:error"]')
        expect(error).to_be_visible(timeout=90_000)
        assert "监控不可用" in error.inner_text(), error.inner_text()
        assert panel.locator('[data-ai-id="container-detail:monitor:empty"]').count() == 0, (
            "请求失败不该显示空态"
        )
        retry = panel.locator('[data-ai-id="container-detail:monitor:retry"]')
        expect(retry).to_be_visible()
        screenshot(ui.page, "container-detail-monitor-error")
    finally:
        ui.page.unroute(MONITOR_GLOB)

    # Retry after the failure recovers to a real answer instead of staying on the error.
    # A refetch keeps the previous (error) state until the new response lands, so wait for
    # the state itself rather than reading it once the click returns.
    ui.page.locator('[data-ai-id="container-detail:monitor:retry"]').click()
    recovered = ui.page.locator('[data-ai-id="container-detail:monitor"]')
    expect(recovered).to_have_attribute("data-ai-state", re.compile(r"^(ready|empty)$"), timeout=90_000)
    assert recovered.locator('[data-ai-id="container-detail:monitor:error"]').count() == 0, (
        "重试成功后不该还显示监控不可用"
    )

    # ---- real zeros: samples exist, values are 0 -> a curve, not the empty state ----
    ui.page.route(
        MONITOR_GLOB,
        lambda route: route.fulfill(status=200, content_type="application/json", body=_zero_matrix()),
    )
    try:
        panel = _open_monitor(ui, url)
        zero_chart = panel.locator('[data-ai-id="container-detail:monitor:chart"]')
        expect(zero_chart).to_be_visible(timeout=90_000)
        assert int(zero_chart.get_attribute("data-ai-points") or 0) > 0, "全 0 的采样也是数据"
        assert panel.locator('[data-ai-id="container-detail:monitor:empty"]').count() == 0, (
            "真实 0 不该退化成空态"
        )
        assert zero_chart.locator("svg path[data-ai-trend-line]").count() > 0, "零值也应画曲线"
        for card in CARDS:
            expect(ui.page.locator(f'[data-ai-id="container-detail:monitor:{card}"]')).to_be_visible()
        screenshot(ui.page, "container-detail-monitor-zero")
    finally:
        ui.page.unroute(MONITOR_GLOB)
