from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

HEALTHY = "健康"
SUB_HEALTHY = "亚健康"


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_GPU_CARD_HEALTH_01(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-GPU_CARD-HEALTH-01 故障卡仍列出并标为亚健康。"""
    gpu_page.open_cluster()
    rows = gpu_page.cluster_rows
    assert rows, "集群显卡列表没有数据行"

    parts = [p for p in rows[0]["href"].split("?")[0].split("/") if p]
    node = parts[parts.index("nodes") + 1]

    registers = gpu_page.node_register(node)
    assert registers, f"节点 {node} 没有 hami.io/node-*-register 注解"

    unhealthy = {
        device["id"]
        for devices in registers.values()
        for device in (devices or [])
        if not device.get("health", False)
    }
    total = sum(len(devices or []) for devices in registers.values())
    assert total > 0, f"注解里没有设备：{registers}"
    if not unhealthy:
        pytest.skip(f"节点 {node} 当前没有不健康设备，无法验证故障卡可见性")

    gpu_page.open_node_status(node)
    node_rows = gpu_page.gpu_card_rows(node)
    assert len(node_rows) == total, (
        f"表格行数 {len(node_rows)} 与注解设备数 {total} 不一致"
    )

    by_uuid = {r["uuid"]: r["status"] for r in node_rows}
    for uuid in unhealthy:
        assert uuid in by_uuid, f"故障卡 {uuid} 没有出现在列表里"
        assert by_uuid[uuid] == SUB_HEALTHY, (
            f"故障卡 {uuid} 显示为 {by_uuid[uuid]}，应为 {SUB_HEALTHY}"
        )
    for uuid, status in by_uuid.items():
        if uuid not in unhealthy:
            assert status == HEALTHY, f"健康卡 {uuid} 显示为 {status}"

    screenshot(gpu_page.page, f"node-{node}-unhealthy-cards")
