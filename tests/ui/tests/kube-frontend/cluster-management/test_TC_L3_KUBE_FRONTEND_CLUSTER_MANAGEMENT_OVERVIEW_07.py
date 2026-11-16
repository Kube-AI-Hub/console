from __future__ import annotations

import math
from urllib.parse import parse_qs, urlsplit

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _ratios(body):
    values = {}
    for result in body.get("results", []):
        samples = {}
        for series in result.get("data", {}).get("result", []):
            for at, raw in series.get("values", []):
                value = float(raw)
                if math.isfinite(value):
                    samples[round(at * 1000)] = value
        values[result["metric_name"]] = samples
    used = values.get("cluster_gpu_memory_usage", {})
    totals = values.get("cluster_gpu_memory_total", {})
    return {at: value / totals[at] * 100 for at, value in used.items() if totals.get(at, 0) > 0}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_07(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07 真实趋势、采样读数、主题和断点。"""
    ui = cluster_overview_page
    def history(response):
        return "/monitoring.kubesphere.io/v1alpha3/cluster?" in response.url and "start" in parse_qs(urlsplit(response.url).query)
    with ui.page.expect_response(lambda response: history(response) and "cluster_gpu_memory_usage" in response.url) as captured:
        ui.open()
    assert captured.value.status == 200
    ui.wait_ready()
    expect(ui.control("trend-panel")).to_have_attribute("data-ai-state", "ready")
    fractions = _ratios(captured.value.json())
    assert len(fractions) >= 2, "真实B200显存历史没有足够采样，不能用模拟替代验收"
    chart = ui.control("trend-chart")
    assert 2 <= int(chart.get_attribute("data-ai-points")) <= len(fractions)
    chart.focus()
    chart.press("Home")
    expect(chart).to_have_attribute("data-ai-cursor-at")
    at = int(chart.get_attribute("data-ai-cursor-at"))
    expect(ui.trend_readout()).to_contain_text(f"{math.floor(fractions[at] + .5)}%")
    chart.hover()
    expect(chart).to_have_attribute("data-ai-cursor-at")
    ranking = ui.control("rank-metric").inner_text()
    ui.hover_resource("cpu")
    assert ui.usage_row("cpu").evaluate("el => getComputedStyle(el).getPropertyValue('--ai-mx')") != ""
    screenshot(ui.page, "dashboard-card-hover")
    with ui.page.expect_response(lambda response: history(response) and "cluster_cpu_usage" in response.url) as cpu:
        ui.select_resource("cpu")
    expect(ui.usage_row("cpu")).to_have_attribute("aria-pressed", "true")
    query = parse_qs(urlsplit(cpu.value.url).query)
    assert query["metrics_filter"] == ["cluster_cpu_usage$|cluster_cpu_total$"]
    expect(ui.control("rank-metric")).to_have_text(ranking)
    for name, seconds, step in (("6h", 21_600, "5m"), ("24h", 86_400, "15m")):
        with ui.page.expect_response(lambda response: history(response) and "cluster_cpu_usage" in response.url) as changed:
            ui.select_trend_range(name)
        query = parse_qs(urlsplit(changed.value.url).query)
        assert int(query["end"][0]) - int(query["start"][0]) == seconds
        assert query["step"] == [step]
    keys = ["ai-kit-theme", "ai-kit-accent", "kube-frontend-locale"]
    original = ui.page.evaluate("keys => keys.map(key => localStorage.getItem(key))", keys)
    try:
        for mode in ("dark", "light"):
            for accent in ("violet", "green"):
                for language in ("zh", "en"):
                    ui.page.evaluate("""values => {
                        localStorage.setItem('ai-kit-theme', values[0]);
                        localStorage.setItem('ai-kit-accent', values[1]);
                        localStorage.setItem('kube-frontend-locale', values[2]);
                    }""", [mode, accent, language])
                    ui.page.reload()
                    ui.wait_ready()
                    expect(ui.control("trend-panel")).to_have_attribute("data-ai-state", "ready")
                    expect(ui.page.locator("html")).to_have_attribute("data-theme", mode)
                    expect(ui.page.locator("html")).to_have_attribute("data-accent", accent)
                    for width in (1024, 1280, 1600):
                        ui.page.set_viewport_size({"width": width, "height": 900})
                        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                        for name in ("gpu-memory", "gpu", "cpu", "memory", "pods", "disk", "nodes"):
                            expect(ui.usage_field(name, "total")).to_be_visible()
                            assert ui.usage_field(name, "total").evaluate("el => el.scrollWidth <= el.clientWidth")
                        screenshot(ui.page, f"dashboard-{mode}-{accent}-{language}-{width}")
        ui.page.emulate_media(reduced_motion="reduce")
        assert ui.control("usage").locator("circle[stroke-dashoffset]").first.evaluate(
            "el => parseFloat(getComputedStyle(el).transitionDuration)") <= .001
        ui.usage_row("cpu").hover()
        assert ui.usage_row("cpu").evaluate("el => getComputedStyle(el).transform") == "none"
    finally:
        ui.page.emulate_media(reduced_motion="no-preference")
        ui.page.evaluate("""data => data.keys.forEach((key, i) => {
            if(data.values[i] === null) localStorage.removeItem(key);
            else localStorage.setItem(key, data.values[i]);
        })""", {"keys": keys, "values": original})
