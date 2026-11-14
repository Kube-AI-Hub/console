from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_08(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-08 真实筛选与模拟多页数据，禁止创建节点。"""
    ui = cluster_management_page
    ui.open("nodes")
    ui.select_node_filter("role", "控制平面节点")
    expect(ui.rows()).to_have_count(1, timeout=30_000)
    assert ui.row_names() == ["gpu01"]
    ui.node_control("filter:vendor").click()
    ui.page.get_by_role("checkbox", name="英伟达", exact=True).click()
    ui.page.keyboard.press("Escape")
    with ui.page.expect_response(lambda response: "/nodes?" in response.url and "xpuModel=B200" in response.url) as response:
        ui.node_control("filter:model").fill("B200")
    params = parse_qs(urlparse(response.value.url).query)
    assert params["role"] == ["master"] and params["deviceVendor"] == ["nvidia"] and params["xpuModel"] == ["B200"]
    expect(ui.rows()).to_have_count(1)
    ui.node_control("filter:role:clear").click()
    expect(ui.rows()).to_have_count(2, timeout=20_000)
    ui.node_control("filters-clear").click()
    expect(ui.node_control("filter:model")).to_have_value("")
    screenshot(ui.page, "node-list-real-filters")

    # Pagination uses a synthetic backend, not disposable production Node objects.
    requests = []
    fake_nodes = [
        {"metadata": {"name": f"node-{index:03}", "labels": {}}, "spec": {},
         "status": {"conditions": [{"type": "Ready", "status": "True"}]}}
        for index in range(105)
    ]

    def list_response(route):
        query = parse_qs(urlparse(route.request.url).query)
        requests.append(query)
        if query.get("role") == ["master"]:
            route.fulfill(json={"items": [], "totalItems": 2})
            return
        page = int(query.get("page", ["1"])[0])
        limit = int(query.get("limit", ["10"])[0])
        selected = [node for node in fake_nodes if query.get("name", [""])[0] in node["metadata"]["name"]]
        items = selected if limit == -1 else selected[(page - 1) * limit:page * limit]
        route.fulfill(json={"items": items, "totalItems": len(selected)})

    ui.page.route(re.compile(r".*/kapis/resources.kubesphere.io/v1alpha3/nodes(?:\?.*)?$"), list_response)
    ui.page.route(re.compile(r".*/kapis/resources.kubesphere.io/v1alpha3/nodes/stats(?:\?.*)?$"),
                  lambda route: route.fulfill(json={"total": 105, "healthy": 105, "CPU": 105}))
    ui.open("nodes")
    expect(ui.rows()).to_have_count(10)
    ui.node_control("page:next").click()
    expect(ui.rows().first).to_contain_text("node-010")
    ui.select_node_page_size(50)
    expect(ui.rows()).to_have_count(50)
    expect(ui.rows().first).to_contain_text("node-000")
    assert any(query.get("page") == ["2"] for query in requests)
    assert any(query.get("limit") == ["50"] and query.get("page") == ["1"] for query in requests)
    ui.node_control("search").fill("node-104")
    expect(ui.rows()).to_have_count(1, timeout=20_000)
    ui.node_control("search:clear").click()
    expect(ui.rows()).to_have_count(50, timeout=20_000)
