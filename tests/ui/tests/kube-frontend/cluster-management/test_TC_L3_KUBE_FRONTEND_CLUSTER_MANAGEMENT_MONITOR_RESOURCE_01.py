from __future__ import annotations

import time
import urllib.parse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS_RANGE = "/kapis/monitoring.kubesphere.io/v1alpha3/pods"
SURFACE = '[data-ai-id="cluster-resource-monitor:surface"]'
WORKLOADS_PANEL = '[data-ai-id="cluster-resource-monitor:tab:workloads"]'
PODS_PANEL = '[data-ai-id="cluster-resource-monitor:tab:pods"]'
HEADERS = ("名称", "项目", "CPU 用量", "内存用量")


def _metrics_available(ui) -> bool:
    """Whether the monitoring backend answers a pod range query with any series."""
    now = int(time.time())
    params = {
        "cluster": ui.cluster,
        "limit": -1,
        "metrics_filter": "pod_cpu_usage$|pod_memory_usage_wo_cache$",
        "start": now - 3600,
        "end": now,
        "step": "5m",
    }
    status, body = ui.api.request("GET", PODS_RANGE + "?" + urllib.parse.urlencode(params))
    if status != 200 or not isinstance(body, dict):
        return False
    return any((result.get("data") or {}).get("result") for result in body.get("results") or [])


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_RESOURCE_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR_RESOURCE-01 应用资源监控：两个页签与时间范围。"""

    ui = cluster_management_page
    assert ui.api is not None
    available = _metrics_available(ui)

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/monitor-resource")
    surface = ui.page.locator(SURFACE).last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    # ---- no metrics: explain, never render an empty table -------------------
    if not available:
        unavailable = ui.page.locator('[data-ai-id="cluster-resource-monitor:unavailable"]')
        empty = ui.page.locator('[data-ai-id="cluster-resource-monitor:empty"]')
        assert unavailable.count() + empty.count() == 1, "监控不可用或无数据时应恰好出现一块说明"
        text = (unavailable if unavailable.count() else empty).inner_text()
        assert "监控" in text, text
        expect(surface.locator("tbody")).to_have_count(0)
        screenshot(ui.page, "resource-monitor-unavailable")
        return

    # ---- default tab: by workload -------------------------------------------
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")
    workload_panel = ui.page.locator(WORKLOADS_PANEL)
    expect(workload_panel).to_be_visible(timeout=30_000)
    # Only the active tab is mounted.
    expect(ui.page.locator(PODS_PANEL)).to_have_count(0)
    workload_rows = workload_panel.locator("tbody tr[data-ai-row]")
    expect(workload_rows.first).to_be_visible(timeout=60_000)
    assert workload_rows.count() > 0
    headers = [text.strip() for text in workload_panel.locator("thead th:visible").all_inner_texts() if text.strip()]
    for expected in HEADERS:
        assert expected in headers, (expected, headers)

    # The range control is present and marks the window the table shows.
    ranges = ui.page.locator('[data-ai-id="cluster-resource-monitor:range"]')
    expect(ranges).to_be_visible()
    for key in ("1h", "6h", "24h", "7d"):
        expect(ui.page.locator(f'[data-ai-id="cluster-resource-monitor:range:{key}"]')).to_be_visible()
    expect(ui.page.locator('[data-ai-id="cluster-resource-monitor:range:1h"]')).to_have_attribute("aria-pressed", "true")

    # ---- switch to by pod ---------------------------------------------------
    ui.page.locator('[data-ai-id="cluster-resource-monitor:tab:pods:trigger"]').click()
    pod_panel = ui.page.locator(PODS_PANEL)
    expect(pod_panel).to_be_visible(timeout=30_000)
    pod_rows = pod_panel.locator("tbody tr[data-ai-row]")
    expect(pod_rows.first).to_be_visible(timeout=60_000)
    assert pod_rows.count() > 0
    headers = [text.strip() for text in pod_panel.locator("thead th:visible").all_inner_texts() if text.strip()]
    for expected in HEADERS:
        assert expected in headers, (expected, headers)
    expect(ui.page.locator(WORKLOADS_PANEL)).to_have_count(0)

    # ---- changing the window re-reads and still ranks ----------------------
    ui.page.locator('[data-ai-id="cluster-resource-monitor:range:24h"]').click()
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    expect(ui.page.locator('[data-ai-id="cluster-resource-monitor:range:24h"]')).to_have_attribute("aria-pressed", "true")
    expect(pod_panel.locator("tbody tr[data-ai-row]").first).to_be_visible(timeout=60_000)
    assert pod_panel.locator("tbody tr[data-ai-row]").count() > 0

    screenshot(ui.page, "resource-monitor")
