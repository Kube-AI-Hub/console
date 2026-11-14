from __future__ import annotations

import math
import re
from urllib.parse import parse_qs, quote, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GPU_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-03 单卡监控单位、关联容器组和节点事件。"""
    ui = cluster_management_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/kapis/gpu.kubesphere.io/v1alpha1/gpus?limit=1")
    assert status == 200 and body["items"]
    card = body["items"][0]
    uuid, node = card["uuid"], card["nodeName"]
    ui.page.goto(f"{ui.url('gpus')}/{quote(uuid, safe='')}")
    expect(ui.gpu_detail_control("basic")).to_be_visible()
    with ui.page.expect_response(lambda response: "/monitoring.kubesphere.io/v1alpha3/nodes/" in response.url and "gpu_uuid=" in response.url) as captured:
        ui.gpu_detail_control("tab:monitor").click()
    response = captured.value
    assert response.status == 200
    assert parse_qs(urlparse(response.url).query)["gpu_uuid"] == [uuid]
    metrics = {
        "gpu_card_utilisation": ("utilisation", "%"),
        "gpu_card_memory_usage": ("memory", "GiB"),
        "gpu_card_allocation_rate": ("allocation", "%"),
        "gpu_card_power": ("power", "W"),
        "gpu_card_temperature": ("temperature", "C"),
    }
    checked = 0
    for result in response.json().get("results", []):
        key, unit = metrics[result["metric_name"]]
        samples = [sample for sample in result.get("data", {}).get("result", [])
                   if sample.get("metric", {}).get("uuid") == uuid and sample.get("metric", {}).get("node") == node]
        values = sorted((float(at), float(value)) for sample in samples for at, value in sample.get("values", [])
                        if math.isfinite(float(value)))
        if not values:
            expect(ui.gpu_detail_control(f"metric:{key}:latest")).to_have_text("-")
            continue
        value = values[-1][1] / 1024 ** 3 if key == "memory" else values[-1][1]
        expect(ui.gpu_detail_control(f"metric:{key}:latest")).to_have_text(f"{value:.2f} {unit}")
        checked += 1
    assert checked == 5, "B200 per-card history did not include all five metric families"
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        screenshot(ui.page, f"gpu-monitor-{width}")
    with ui.page.expect_response(lambda response: "gpu_uuid=" in response.url and "step=5m" in response.url) as longer:
        ui.gpu_detail_control("range:6h").click()
    assert parse_qs(urlparse(longer.value.url).query)["gpu_uuid"] == [uuid]
    with ui.page.expect_response(lambda response: "/pods?" in response.url and "gpuUuid=" in response.url) as pods:
        ui.gpu_detail_control("tab:pods").click()
    query = parse_qs(urlparse(pods.value.url).query)
    assert query["gpuUuid"] == [uuid] and query["nodeName"] == [node]
    assert pods.value.status == 200
    expect(ui.gpu_detail_control("pods").locator("[data-ai-row]")).to_have_count(len(pods.value.json()["items"]))
    with ui.page.expect_response(lambda response: "/api/v1/events?" in response.url) as events:
        ui.gpu_detail_control("tab:events").click()
    selector = parse_qs(urlparse(events.value.url).query)["fieldSelector"][0]
    assert "involvedObject.kind=Node" in selector and f"involvedObject.name={node}" in selector
    expect(ui.page.get_by_text("这里展示所属节点的事件，不代表这些事件全部由此显卡引起。")).to_be_visible()

    failed = {"value": True}
    def monitored(route):
        if failed["value"]:
            route.fulfill(status=500, json={"message": "mock monitoring unavailable"})
        else:
            route.continue_()
    ui.page.route(re.compile(r".*/kapis/monitoring.kubesphere.io/v1alpha3/nodes/.*"), monitored)
    ui.gpu_detail_control("tab:monitor").click()
    with ui.page.expect_response(lambda response: response.status == 500 and "gpu_uuid=" in response.url):
        ui.gpu_detail_control("monitor-refresh").click()
    expect(ui.page.get_by_role("alert")).to_contain_text("网络异常，请稍后重试")
    failed["value"] = False
    ui.gpu_detail_control("monitor-retry").click()
    expect(ui.gpu_detail_control("metric:power:latest")).not_to_have_text("-")
