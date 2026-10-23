from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

HEALTHY = "健康"
SUB_HEALTHY = "亚健康"


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_GPU_CARD_HEALTH_02(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-02 全部健康时不出现亚健康。"""
    gpu_page.open_cluster()
    rows = gpu_page.cluster_rows
    assert rows, "集群显卡列表没有数据行"

    parts = [p for p in rows[0]["href"].split("?")[0].split("/") if p]
    node = parts[parts.index("nodes") + 1]

    registers = gpu_page.node_register(node)
    devices = [d for devices in registers.values() for d in (devices or [])]
    if not devices or not all(d.get("health", False) for d in devices):
        pytest.skip(f"节点 {node} 上存在不健康设备，本用例要求全部健康")

    gpu_page.open_node_status(node)
    node_rows = gpu_page.gpu_card_rows(node)
    assert node_rows, f"节点 {node} 的显卡列表没有数据行"

    statuses = [r["status"] for r in node_rows]
    assert SUB_HEALTHY not in statuses, f"全部健康时出现了亚健康：{statuses}"
    assert all(s == HEALTHY for s in statuses), statuses

    screenshot(gpu_page.page, f"node-{node}-all-healthy")
