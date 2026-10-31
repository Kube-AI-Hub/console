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
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_CAPACITY_02(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-02 default 下 vgpuTotal 为 0。"""

    node, items = _first_node_gpus(gpu_page)
    modes = {item.get("mode") or "default" for item in items}
    if modes - {"default"}:
        pytest.skip(f"节点 {node} 不在 default 模式：{modes}")

    for item in items:
        assert int(item.get("vgpuTotal") or 0) == 0, (
            f"default 模式下 {item.get('uuid')} 的 vgpuTotal 应为 0，"
            f"实际 {item.get('vgpuTotal')}"
        )
    screenshot(gpu_page.page, f"node-{node}-default-mode")
