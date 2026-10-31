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
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_SWITCH_02(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-02 切回 default 时参数区为空且模式列显示默认。"""

    gpu_page.page.goto(ui_config.cluster_url("nodes"), wait_until="domcontentloaded")
    gpu_page.page.wait_for_selector("thead th", timeout=30_000)
    text = gpu_page.page.evaluate("() => document.body.innerText")
    assert "VGPU_MODE" not in text and "GPU_MODE_" not in text, "节点列表出现未翻译的 key"
    screenshot(gpu_page.page, "nodes-default-state")
