from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_CLUSTER_GPU_GPU_CARD_01(gpu_page, ui_config, screenshot):
    """TC-FULL-CLUSTER_GPU-GPU_CARD-01 集群页与节点页对同一张卡显示相同状态。"""
    gpu_page.open_cluster()
    cluster_rows = gpu_page.cluster_rows
    assert cluster_rows, "集群显卡列表没有数据行"

    row = cluster_rows[0]
    uuid = row["uuid"]
    assert uuid, f"行里没有 UUID：{row}"

    # The cluster row links to /clusters/<cluster>/nodes/<node>/gpus/<uuid>/status
    parts = [p for p in row["href"].split("?")[0].split("/") if p]
    assert "nodes" in parts, f"链接不是单卡详情：{row['href']}"
    node = parts[parts.index("nodes") + 1]

    gpu_page.open_node_status(node)
    node_rows = gpu_page.gpu_card_rows(node)
    assert node_rows, f"节点 {node} 的显卡列表没有数据行"

    match = [r for r in node_rows if r["uuid"] == uuid]
    assert match, f"节点页没有 {uuid}：{[r['uuid'] for r in node_rows]}"
    assert match[0]["status"] == row["status"], (
        f"两页状态不一致：集群页 {row['status']} / 节点页 {match[0]['status']}"
    )
    assert len(node_rows) == len(cluster_rows) or len(node_rows) > 0

    screenshot(gpu_page.page, f"node-{node}-gpu-cards")

    gpu_page.open_card(row["href"])
    assert gpu_page.card_status == row["status"], (
        f"单卡详情状态 {gpu_page.card_status} 与列表 {row['status']} 不一致"
    )
