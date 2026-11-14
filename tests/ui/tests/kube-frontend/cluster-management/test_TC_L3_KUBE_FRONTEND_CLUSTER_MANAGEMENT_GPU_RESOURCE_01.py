from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MONITORING = "/kapis/monitoring.kubesphere.io/v1alpha3/cluster"
#: The same filter the page sends: one regex with anchored names.
METRICS_FILTER = "cluster_gpu_utilization$|cluster_gpu_memory_utilisation$"

WINDOWS = {
    "1h": (3600, "60s"),
    "6h": (6 * 3600, "5m"),
    "24h": (24 * 3600, "15m"),
}


def _point_count(api, cluster: str, duration: int, step: str) -> int | None:
    """Samples the monitoring API returns for the two GPU metrics in one window.

    Read directly so the test asserts against the same source the page uses: a
    backend without GPU recording rules answers an empty result, and the page must
    then show the empty state rather than an empty chart.
    """
    end = int(time.time())
    start = end - duration
    path = (
        f"{MONITORING}?metrics_filter={METRICS_FILTER}"
        f"&start={start}&end={end}&step={step}&cluster={cluster}"
    )
    status, body = api.request("GET", path)
    if status != 200 or not isinstance(body, dict):
        return None
    total = 0
    for result in body.get("results") or []:
        for series in ((result.get("data") or {}).get("result") or []):
            total += len(series.get("values") or [])
    return total


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GPU_RESOURCE_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU_RESOURCE-01 GPU 资源监控：窗口切换/趋势/空态。"""

    ui = cluster_management_page
    assert ui.api is not None

    samples = _point_count(ui.api, ui.cluster, *WINDOWS["1h"])
    if samples is None:
        pytest.skip("监控区间接口不可用，无法判断 GPU 资源页的数据前提")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gpu-resource")
    surface = ui.page.locator('[data-ai-id="cluster-gpu-resource:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    # ---- the window control exists and starts on 1h ----
    expect(ui.page.locator('[data-ai-id="cluster-gpu-resource:range"]')).to_be_visible(timeout=20_000)
    for key in WINDOWS:
        expect(ui.page.locator(f'[data-ai-id="cluster-gpu-resource:range:{key}"]')).to_be_visible()
    one_hour = ui.page.locator('[data-ai-id="cluster-gpu-resource:range:1h"]')
    expect(one_hour).to_have_attribute("aria-pressed", "true")

    chart = ui.page.locator('[data-ai-id="cluster-gpu-resource:chart"]')
    empty = ui.page.locator('[data-ai-id="cluster-gpu-resource:empty"]')
    # Either the trends or the explicit empty state must settle into place.
    ui.page.wait_for_selector(
        '[data-ai-id="cluster-gpu-resource:chart"], [data-ai-id="cluster-gpu-resource:empty"]',
        timeout=60_000,
    )

    # ---- data present: bars exist; data absent: the empty state exists ----
    if samples > 0:
        expect(chart).to_be_visible(timeout=20_000)
        expect(chart).to_have_attribute("data-ai-window", "1h")
        assert int(chart.get_attribute("data-ai-points") or 0) > 0, "图表没有采样点"
        bars = chart.locator("[data-ai-bar]")
        expect(bars.first).to_be_visible(timeout=20_000)
        assert bars.count() > 0, "有数据但趋势图没有柱子"
        for metric in ("utilization", "memory"):
            card = ui.page.locator(f'[data-ai-id="cluster-gpu-resource:{metric}"]')
            expect(card).to_be_visible()
            assert int(card.get_attribute("data-ai-points") or 0) > 0, f"{metric} 卡片没有采样点"
    else:
        expect(empty).to_be_visible(timeout=20_000)

    # ---- switching windows changes the pressed button and the plotted window ----
    for key in ("6h", "24h"):
        button = ui.page.locator(f'[data-ai-id="cluster-gpu-resource:range:{key}"]')
        button.click()
        expect(button).to_have_attribute("aria-pressed", "true")
        expect(one_hour).to_have_attribute("aria-pressed", "false")
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        ui.page.wait_for_selector(
            '[data-ai-id="cluster-gpu-resource:chart"], [data-ai-id="cluster-gpu-resource:empty"]',
            timeout=60_000,
        )
        if ui.page.locator('[data-ai-id="cluster-gpu-resource:chart"]').count():
            expect(ui.page.locator('[data-ai-id="cluster-gpu-resource:chart"]')).to_have_attribute(
                "data-ai-window", key
            )

    # ---- back to 1h for the artifact ----
    one_hour.click()
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    if samples > 0:
        ui.page.wait_for_selector('[data-ai-id="cluster-gpu-resource:chart"]', timeout=60_000)
        expect(ui.page.locator('[data-ai-id="cluster-gpu-resource:chart"]')).to_have_attribute("data-ai-window", "1h")
    screenshot(ui.page, "cluster-gpu-resource")
