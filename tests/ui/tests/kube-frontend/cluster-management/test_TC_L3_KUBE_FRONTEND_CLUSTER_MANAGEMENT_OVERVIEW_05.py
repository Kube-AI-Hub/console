from __future__ import annotations

from urllib.parse import parse_qs, urlsplit
import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

METRICS = {
    "node_gpu_memory_utilisation": "GPU 显存用量（%）",
    "node_gpu_utilisation": "GPU 用量（%）",
    "node_gpu_allocated": "GPU 分配量（按卡数排序）",
    "node_cpu_utilisation": "CPU 使用率",
    "node_load1": "1 分钟 CPU 平均负载",
    "node_memory_utilisation": "内存使用率",
    "node_disk_size_utilisation": "磁盘使用率",
    "node_disk_inode_utilisation": "inode 使用率",
    "node_pod_utilisation": "容器组配额使用率",
}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_05(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05 九种 Top5 与下钻、全局分页。"""
    ui = cluster_overview_page
    def ranking(response):
        return "/monitoring.kubesphere.io/v1alpha3/nodes?" in response.url and "type=rank" in response.url

    with ui.page.expect_response(ranking) as response:
        ui.open()
    assert response.value.status == 200
    ui.wait_ready()
    default = response.value.json()
    target = next(result for result in default["results"] if result["metric_name"] == "node_gpu_memory_utilisation")
    # Monitoring can return samples without node labels; those are not ranking rows.
    expected = list(dict.fromkeys(
        sample.get("metric", {}).get("node")
        for result in [target, *default["results"]]
        if result.get("metric_name") in {*METRICS, "node_gpu_total", "node_pod_running_count"}
        for sample in result.get("data", {}).get("result", [])
        if sample.get("metric", {}).get("node")
    ))
    expect(ui.ranking_rows()).to_have_count(len(expected))
    assert ui.ranking_rows().evaluate_all("rows => rows.map(row => row.getAttribute('data-ai-row'))") == expected
    assert len(expected) <= 5
    for metric, label in list(METRICS.items())[1:]:
        with ui.page.expect_response(lambda result: ranking(result) and f"sort_metric={metric}" in result.url) as selected:
            ui.select_rank_metric(label)
        assert selected.value.status == 200
        expect(ui.control("ranking")).not_to_have_attribute("data-ai-state", "loading")
        for value in ui.ranking_rows().all():
            text = value.inner_text()
            if metric == "node_load1":
                assert "%" not in text
        assert ui.control("rank-more").get_attribute("href").endswith(f"?metric={metric}")
    with ui.page.expect_response(ranking):
        ui.control("rank-more").click()
    expect(ui.full_rank("metric")).to_contain_text(METRICS["node_pod_utilisation"])
    expect(ui.full_rank("surface")).to_have_attribute("data-ai-state", "ready")
    screenshot(ui.page, "full-node-ranking-real")

    # Twelve nodes are simulated to prove TopN and paging independently of B200's two nodes.
    def synthetic(route):
        query = parse_qs(urlsplit(route.request.url).query)
        if query.get("type") != ["rank"]:
            route.continue_()
            return
        page, size = int(query["page"][0]), int(query["limit"][0])
        indexes = list(range(12))[(page - 1) * size:page * size]
        route.fulfill(json={"total_item": 12, "results": [
            {"metric_name": metric, "data": {"result": [
                {"metric": {"node": f"sim-{12 - index}"}, "value": [1, str((12 - index) / 20)]}
                for index in indexes
            ]}} for metric in METRICS
        ]})

    ui.page.route("**/monitoring.kubesphere.io/v1alpha3/nodes?*", synthetic)
    ui.open()
    expect(ui.ranking_rows()).to_have_count(5)
    expect(ui.ranking_rows().first).to_contain_text("sim-12")
    ui.control("rank-more").click()
    expect(ui.full_rank_rows()).to_have_count(12)
    ui.page.get_by_role("combobox", name="每页条数").click()
    ui.page.get_by_role("option", name="10", exact=True).click()
    expect(ui.full_rank_rows()).to_have_count(10)
    ui.page.get_by_role("button", name="下一页", exact=True).click()
    expect(ui.full_rank_rows()).to_have_count(2)
    expect(ui.full_rank_rows().first).to_contain_text("sim-2")
    screenshot(ui.page, "ranking-paging-simulated")
