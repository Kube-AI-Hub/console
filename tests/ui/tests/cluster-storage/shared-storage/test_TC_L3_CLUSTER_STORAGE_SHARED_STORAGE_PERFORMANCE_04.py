from __future__ import annotations

import json

import pytest

pytestmark = pytest.mark.ui

VOLUMES_GLOB = "**/kapis/juicefs.kubesphere.io/v1alpha1/volumes*"
BENCH_GLOB = "**/kapis/juicefs.kubesphere.io/v1alpha1/bench*"


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_PERFORMANCE_04(
    storage_page, screenshot
):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-04 无卷时提示停住，volumes/bench 不再刷。"""
    page = storage_page.page
    counts = {"volumes": 0, "bench": 0}

    def on_volumes(route):
        request = route.request
        path = request.url.split("?", 1)[0]
        if request.method == "GET" and path.rstrip("/").endswith("/volumes"):
            counts["volumes"] += 1
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"items": [], "totalItems": 0}),
            )
            return
        route.continue_()

    def on_bench(route):
        if route.request.method == "GET":
            counts["bench"] += 1
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"items": [], "totalItems": 0}),
            )
            return
        route.continue_()

    page.route(VOLUMES_GLOB, on_volumes)
    page.route(BENCH_GLOB, on_bench)
    try:
        storage_page.open("performance")
        storage_page.wait_performance_ready()
        screenshot(page, "performance-metrics-off")

        assert storage_page.metrics_off, "空卷列表应给出指标未开启提示，而不是六张空图"
        assert storage_page.chart_titles == [], storage_page.chart_titles
        assert "没有可测试的共享卷" in storage_page.body_text
        assert page.locator("button:has-text('开始测试')").count() == 0

        after_hint = dict(counts)
        page.wait_for_timeout(3000)

        assert counts["volumes"] == after_hint["volumes"], (
            f"提示出现后 volumes 仍在请求：{after_hint['volumes']} → {counts['volumes']}"
        )
        assert counts["volumes"] <= 2, f"空列表不应反复拉卷：{counts['volumes']} 次"
        assert counts["bench"] == 0, f"没有卷时不应请求 bench：{counts['bench']} 次"
        assert counts["volumes"] >= 1, "打开性能页应至少拉一次卷列表"
    finally:
        page.unroute(VOLUMES_GLOB)
        page.unroute(BENCH_GLOB)
