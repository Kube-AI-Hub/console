from __future__ import annotations

import json

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_GPU_CARD_LIST_02(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_CARD-LIST-02 子集群显卡页列表与 stats 带 cluster。"""

    page = gpu_page.page
    captured: dict[str, list[str]] = {"list": [], "stats": []}

    def on_route(route):
        request = route.request
        if request.method != "GET":
            route.continue_()
            return
        url = request.url
        if "/gpu.kubesphere.io/v1alpha1/gpus/stats" in url:
            captured["stats"].append(url)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"total": 1, "healthy": 1, "kunlunxin-R200": 1}),
            )
            return
        if "/gpu.kubesphere.io/v1alpha1/gpus" in url:
            captured["list"].append(url)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"items": [], "totalItems": 0}),
            )
            return
        route.continue_()

    page.route("**/kapis/gpu.kubesphere.io/v1alpha1/gpus*", on_route)
    try:
        page.goto(ui_config.url("clusters/xc/gpus"), wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        screenshot(page, "xc-cluster-gpus")
        if not captured["list"] and not captured["stats"]:
            pytest.skip("成员集群 xc 的显卡页没有发出 GPU 请求")
        for kind, urls in captured.items():
            for url in urls:
                assert "cluster=xc" in url, f"{kind} 未带 cluster=xc: {url}"
                assert "/kapis/clusters/xc/" not in url
    finally:
        page.unroute("**/kapis/gpu.kubesphere.io/v1alpha1/gpus*")
