from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GPU_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-02 真实筛选与模拟多页、失败恢复。"""
    ui = cluster_management_page
    assert ui.api is not None
    status, body = ui.api.request("GET", "/kapis/gpu.kubesphere.io/v1alpha1/gpus?limit=-1")
    assert status == 200 and body["items"]
    card = body["items"][0]
    ui.page.goto(ui.url("gpus"))
    expect(ui.gpu_rows()).to_have_count(min(len(body["items"]), 20))
    health = ui.gpu_control("health")
    expect(health).to_have_attribute("data-ai-total", str(body["totalItems"]))
    ui.gpu_control("filter:node").fill(card["nodeName"])
    ui.gpu_control("filter:model").fill(card["type"])
    ui.select_gpu_filter("vendor", "英伟达")
    with ui.page.expect_response(lambda response: "/gpus?" in response.url and "uuid=" in response.url) as captured:
        ui.gpu_control("search").fill(card["uuid"])
    query = parse_qs(urlparse(captured.value.url).query)
    assert query["uuid"] == [card["uuid"]]
    expect(ui.gpu_rows()).to_have_count(1)
    expect(health).to_have_attribute("data-ai-total", str(body["totalItems"]))
    ui.gpu_control("filters-clear").click()
    expect(ui.gpu_rows()).to_have_count(min(len(body["items"]), 20))
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        screenshot(ui.page, f"gpu-list-{width}")
    ui.gpu_control("columns").click()
    ui.gpu_control("columns:memory").click()
    expect(ui.page.get_by_role("columnheader", name="显存（已用 / 总量）", exact=True)).to_have_count(0)
    ui.gpu_control("columns:reset").click()
    ui.page.keyboard.press("Escape")

    requests = []
    fake = [{**card, "uuid": f"GPU-test-{index:03}", "index": index} for index in range(125)]

    def response(route):
        query = parse_qs(urlparse(route.request.url).query)
        requests.append(query)
        if query.get("labelSelector") == ["bad=="]:
            route.fulfill(status=400, json={"message": "mock invalid selector"})
            return
        rows = [item for item in fake if not query.get("uuid") or item["uuid"] == query["uuid"][0]]
        page = int(query.get("page", ["1"])[0])
        size = int(query.get("limit", ["20"])[0])
        route.fulfill(json={"items": rows[(page - 1) * size:page * size], "totalItems": len(rows)})

    ui.page.route(re.compile(r".*/kapis/gpu.kubesphere.io/v1alpha1/gpus(?:\?.*)?$"), response)
    ui.page.goto(ui.url("gpus"))
    expect(ui.gpu_rows()).to_have_count(20)
    ui.gpu_control("page:next").click()
    expect(ui.gpu_rows().first).to_contain_text("GPU-test-020")
    ui.select_gpu_page_size(50)
    expect(ui.gpu_rows()).to_have_count(50)
    expect(ui.gpu_rows().first).to_contain_text("GPU-test-000")
    ui.gpu_control("search").fill("GPU-test-124")
    expect(ui.gpu_rows()).to_have_count(1)
    ui.gpu_control("search:clear").click()
    expect(ui.gpu_rows()).to_have_count(50)
    ui.gpu_control("filter:labels").fill("bad==")
    expect(ui.page.get_by_role("alert")).to_contain_text("mock invalid selector")
    expect(ui.gpu_control("filter:labels")).to_have_value("bad==")
    ui.gpu_control("filter:labels:clear").click()
    expect(ui.gpu_rows()).to_have_count(50)
    assert any(query.get("page") == ["2"] for query in requests)
    assert any(query.get("limit") == ["50"] and query.get("page") == ["1"] for query in requests)
