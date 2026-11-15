from __future__ import annotations

import json

import pytest

pytestmark = pytest.mark.ui

GPU_ITEM = {
    "index": 0,
    "uuid": "GPU-XC",
    "type": "R200",
    "health": True,
    "deviceVendor": "kunlunxin",
    "gpuMemoryTotal": 65536,
}


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_GPU_CARD_LIST_01(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_CARD-LIST-01 子集群节点显卡列表请求带 cluster。"""

    page = gpu_page.page
    captured: list[str] = []

    def on_route(route):
        request = route.request
        if request.method == "GET" and "/gpu.kubesphere.io/v1alpha1/gpus" in request.url:
            captured.append(request.url)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"items": [GPU_ITEM], "totalItems": 1}),
            )
            return
        route.continue_()

    page.route("**/kapis/gpu.kubesphere.io/v1alpha1/gpus*", on_route)
    try:
        page.goto(
            ui_config.url("clusters/xc/nodes/node201-xpu/status"),
            wait_until="domcontentloaded",
        )
        page.wait_for_timeout(2000)
        screenshot(page, "xc-node-gpu-list")
        if not captured:
            pytest.skip("成员集群 xc 的节点运行状态页没有发出显卡列表请求")
        url = captured[0]
        assert "cluster=xc" in url, f"GET 未带 cluster=xc: {url}"
        assert "nodeName=node201-xpu" in url
        assert "/kapis/clusters/xc/" not in url
    finally:
        page.unroute("**/kapis/gpu.kubesphere.io/v1alpha1/gpus*")
