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
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_CAPACITY_01(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-01 hami-core 下 vgpuTotal 为正且 vgpuUsed 不超过它。"""

    node, items = _first_node_gpus(gpu_page)
    modes = {item.get("mode") or "default" for item in items}
    if "hami-core" not in modes:
        pytest.skip(f"节点 {node} 不在 hami-core 模式：{modes}")

    for item in items:
        total = int(item.get("vgpuTotal") or 0)
        used = int(item.get("vgpuUsed") or 0)
        assert total > 0, f"{item.get('uuid')} 在 hami-core 下 vgpuTotal 应为正数"
        assert used <= total, f"{item.get('uuid')} vgpuUsed {used} 大于 vgpuTotal {total}"
    screenshot(gpu_page.page, f"node-{node}-vgpu-capacity")
