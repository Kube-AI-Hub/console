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
def test_TC_L3_CLUSTER_GPU_GPU_MONITOR_VENDOR_DISPATCH_01(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_MONITOR-VENDOR_DISPATCH-01 分派表覆盖当前节点的厂商与模式。"""

    node, items = _first_node_gpus(gpu_page)
    vendor = (items[0].get("deviceVendor") or "").lower()
    mode = items[0].get("mode") or "default"
    known = {"nvidia", "cambricon", "ascend", "hygon"}
    assert vendor in known, f"未知厂商 {vendor}，分派表需要补一行"
    assert mode in {"default", "hami-core", "mig", "env-share", "dynamic-smlu"}, (
        f"未知虚拟化方式 {mode}，分派表需要补一行"
    )
    screenshot(gpu_page.page, f"node-{node}-{vendor}-{mode}")
