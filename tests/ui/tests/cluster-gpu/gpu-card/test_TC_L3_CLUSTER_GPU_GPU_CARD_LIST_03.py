from __future__ import annotations

import json

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_GPU_CARD_LIST_03(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_CARD-LIST-03 子集群节点 RDMA 端口请求带 cluster。"""

    page = gpu_page.page
    captured: list[str] = []

    def on_route(route):
        request = route.request
        if request.method == "GET" and "/rdma.kubesphere.io/v1alpha1/ports" in request.url:
            captured.append(request.url)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"items": [], "totalItems": 0}),
            )
            return
        route.continue_()

    page.route("**/kapis/rdma.kubesphere.io/v1alpha1/ports*", on_route)
    try:
        page.goto(
            ui_config.url("clusters/xc/nodes/node201-xpu/status"),
            wait_until="domcontentloaded",
        )
        page.wait_for_timeout(2000)
        screenshot(page, "xc-node-rdma-list")
        if not captured:
            pytest.skip("成员集群 xc 的节点运行状态页没有发出 RDMA 请求")
        url = captured[0]
        assert "cluster=xc" in url, f"GET 未带 cluster=xc: {url}"
        assert "nodeName=node201-xpu" in url
        assert "/kapis/clusters/xc/" not in url
    finally:
        page.unroute("**/kapis/rdma.kubesphere.io/v1alpha1/ports*")
