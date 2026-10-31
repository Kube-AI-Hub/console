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
def test_TC_L3_CLUSTER_GPU_GPU_MONITOR_CARD_METRICS_01(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_MONITOR-CARD_METRICS-01 单卡监控按 UUID 隔离。"""

    node, items = _first_node_gpus(gpu_page)
    uuid = items[0].get("uuid")
    assert uuid, "显卡没有 UUID"
    gpu_page.open_card(f"/clusters/{ui_config.cluster}/nodes/{node}/gpus/{uuid}/status")
    gpu_page.page.wait_for_timeout(2000)
    tabs = gpu_page.page.evaluate(
        "() => Array.from(document.querySelectorAll('.ks-tabs__item, [role=tab]')).map((t) => t.textContent.trim())"
    )
    assert any("监控" in t for t in tabs), f"单卡详情没有监控页签：{tabs}"
    screenshot(gpu_page.page, f"card-{uuid[:16]}-monitoring-tabs")
