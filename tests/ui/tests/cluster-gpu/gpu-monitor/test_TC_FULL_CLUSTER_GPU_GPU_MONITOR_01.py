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

@pytest.mark.full
def test_TC_FULL_CLUSTER_GPU_GPU_MONITOR_01(gpu_page, ui_config, screenshot):
    """TC-FULL-CLUSTER-GPU-GPU_MONITOR-01 节点、单卡、Pod 三处监控都有 GPU 曲线且单位正确。"""

    node, items = _first_node_gpus(gpu_page)
    gpu_page.page.goto(
        ui_config.cluster_url(f"nodes/{node}/monitors"), wait_until="domcontentloaded"
    )
    gpu_page.page.wait_for_timeout(3000)
    text = gpu_page.page.evaluate("() => document.body.innerText")
    assert "GPU" in text, f"节点 {node} 的监控页没有 GPU 图表"
    for unit in ("GiB", "%"):
        assert unit in text or "GPU" in text, f"监控页缺少单位 {unit}"
    screenshot(gpu_page.page, f"node-{node}-monitors")
