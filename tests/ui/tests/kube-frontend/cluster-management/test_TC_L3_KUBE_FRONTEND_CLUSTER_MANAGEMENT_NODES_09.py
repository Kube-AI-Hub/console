from __future__ import annotations

import math
import statistics

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_09(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-09 指标单位、厂商和全局 NTP 口径。"""
    ui = cluster_management_page
    with ui.page.expect_response(lambda response: "/monitoring.kubesphere.io/v1alpha3/nodes?" in response.url and "node_gpu_usage" in response.url) as response, \
            ui.page.expect_response(lambda response: "/monitoring.kubesphere.io/v1alpha3/nodes?" in response.url and "node_time_seconds" in response.url) as time_response:
        ui.open("nodes")
    assert response.value.status == 200
    values = {}
    for result in response.value.json()["results"]:
        for sample in result.get("data", {}).get("result", []):
            value = sample.get("value", [None, None])[1]
            name = sample.get("metric", {}).get("node")
            if name and value is not None:
                parsed = float(value)
                if math.isfinite(parsed):
                    values.setdefault(name, {})[result["metric_name"]] = parsed
    assert values, "No node metric data returned"
    for name in ui.row_names():
        data = values[name]
        for kind, metric in (("gpu", "node_gpu_utilisation"), ("gpuMemory", "node_gpu_memory_utilisation"),
                             ("cpu", "node_cpu_utilisation"), ("memory", "node_memory_utilisation")):
            expect(ui.node_metric_value(kind, name)).to_have_text(f'{math.floor(data[metric] * 100 + .5)}%')
        expect(ui.node_metric("gpu", name)).to_contain_text(f'已分配：{data["node_gpu_allocated"]:g} 卡')
        expect(ui.node_metric("gpuMemory", name)).to_contain_text(f'{data["node_gpu_memory_usage"] / 1024 ** 3:.2f} GiB')
        expect(ui.node_metric("pods", name)).to_contain_text(f'{data["node_pod_running_count"]:.0f} / {data["node_pod_quota"]:.0f}')
        expect(ui.node_vendor(name)).to_contain_text("英伟达")
        expect(ui.node_vendor(name)).to_contain_text("B200")
        expect(ui.node_mode(name)).to_contain_text("独占")
    times = {}
    for result in time_response.value.json().get("results", []):
        if result["metric_name"] != "node_time_seconds":
            continue
        for sample in result.get("data", {}).get("result", []):
            times[sample["metric"]["node"]] = float(sample["value"][1])
    if times:
        median = statistics.median(times.values())
        for name in ui.row_names():
            offset = math.floor(times[name] - median + .5)
            expect(ui.node_time(name)).to_contain_text(f'{"+" if offset > 0 else ""}{offset}s')
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        expect(ui.node_table()).to_be_visible()
        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Wide table overflowed the page instead of its shared scroll container"
        screenshot(ui.page, f"node-list-metrics-{width}")
    ui.node_control("columns").click()
    ui.node_control("columns:gpuMemory").click()
    expect(ui.page.get_by_role("columnheader", name="GPU 显存用量", exact=True)).to_have_count(0)
    ui.node_control("columns:reset").click()
    ui.page.keyboard.press("Escape")
    expect(ui.page.get_by_role("columnheader", name="GPU 显存用量", exact=True)).to_be_attached()
