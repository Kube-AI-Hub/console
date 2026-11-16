from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_08(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-08 受控时钟、暂停、可见性和旧值标识。"""
    ui = cluster_overview_page
    ui.page.clock.install()
    reads = []
    failed = False
    def metrics(route):
        query = parse_qs(urlsplit(route.request.url).query)
        if "start" not in query:
            reads.append(query)
            if failed:
                route.fulfill(status=500, json={"message": "simulated read failure"})
                return
        names = query.get("metrics_filter", [""])[0].split("|")
        route.fulfill(json={"results": [
            {"metric_name": name.rstrip("$"), "data": {"resultType": "matrix" if "start" in query else "vector",
                "result": [{"values": [[int(query["end"][0]) - 60, "8" if "total" in name else "0"]]}]
                if "start" in query else [{"metric": {}, "value": [1, "0" if name.startswith("cluster_gpu_total") or "usage" in name else "8"]}]}}
            for name in names
        ]})
    ui.page.route("**/monitoring.kubesphere.io/v1alpha3/cluster?*", metrics)
    ui.open()
    ui.wait_ready()
    expect(ui.control("refresh")).to_be_enabled()
    expect(ui.control("refresh-time")).to_have_count(0)
    expect(ui.control("auto-refresh")).to_have_text("暂停")
    expect(ui.control("auto-refresh")).to_have_attribute("aria-label", "暂停自动刷新（每30秒）")
    expect(ui.control("auto-refresh").locator('use')).to_have_attribute("href", "#icon-pause")
    expect(ui.control("refresh").locator('use')).to_have_attribute("href", "#icon-refresh")
    assert "bg-transparent" in ui.control("refresh").get_attribute("class")
    assert "bg-transparent" in ui.control("auto-refresh").get_attribute("class")
    assert "bg-ai-accent" in ui.control("shortcut:kubectl").get_attribute("class")
    assert len(reads) == 1
    ui.page.clock.run_for(30_000)
    expect(ui.control("refresh")).to_be_enabled()
    assert len(reads) == 2
    ui.control("auto-refresh").click()
    expect(ui.control("auto-refresh")).to_have_attribute("aria-pressed", "false")
    expect(ui.control("auto-refresh")).to_have_text("继续")
    expect(ui.control("auto-refresh").locator('use')).to_have_attribute("href", "#icon-start")
    ui.page.clock.run_for(60_000)
    assert len(reads) == 2
    ui.page.evaluate("""() => {
        Object.defineProperty(document, 'visibilityState', {configurable:true, value:'hidden'});
        document.dispatchEvent(new Event('visibilitychange'));
    }""")
    ui.control("auto-refresh").click()
    ui.page.clock.run_for(90_000)
    assert len(reads) == 2
    ui.page.evaluate("""() => {
        Object.defineProperty(document, 'visibilityState', {configurable:true, value:'visible'});
        document.dispatchEvent(new Event('visibilitychange'));
    }""")
    expect(ui.control("refresh")).to_be_enabled()
    assert len(reads) == 3
    failed = True
    ui.control("refresh").click()
    expect(ui.control("no-metrics")).to_contain_text("旧值")
    expect(ui.control("refresh-failed")).to_be_visible()
    expect(ui.usage_field("cpu", "total")).to_have_text("8")
    expect(ui.control("refresh-time")).to_have_count(0)
    screenshot(ui.page, "dashboard-refresh-failure-simulated")
