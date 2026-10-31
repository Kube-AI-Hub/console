from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

MODE_LABEL = "GPU虚拟化模式"


def _first_node_gpus(gpu_page):
    """Return (node, items) for the first node that has GPUs."""
    api = gpu_page.gpu_api()
    items = api.get("items") or []
    if not items:
        pytest.skip("集群里没有显卡，无法验证 GPU 相关用例")
    node = items[0].get("nodeName")
    node_items = [i for i in items if i.get("nodeName") == node]
    return node, node_items

@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_GPU_MONITOR_POD_METRICS_01(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_MONITOR-POD_METRICS-01 Pod 的 GPU 分配量与分配注解一致。"""

    api = gpu_page.gpu_api()
    items = api.get("items") or []
    assert items, "集群里没有显卡"
    allocated = [
        item for item in items
        if int(item.get("vgpuUsed") or 0) > 0
    ]
    if not allocated:
        pytest.skip("当前没有 Pod 占用 GPU，无法验证 Pod 级指标")
    screenshot(gpu_page.page, "gpus-with-allocations")
