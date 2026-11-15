from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_CAPACITY_04(gpu_page, screenshot):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-04 昆仑芯独占时切分数为 1，虚拟卡数等于卡数。"""

    api = gpu_page.gpu_api("node201-xpu")
    items = [
        item for item in (api.get("items") or [])
        if str(item.get("deviceVendor") or "").lower() == "kunlunxin"
    ]
    if not items:
        pytest.skip("node201-xpu 没有昆仑芯卡")
    modes = {item.get("mode") or "default" for item in items}
    if modes != {"default"}:
        pytest.skip(f"node201-xpu 不在独占：{modes}")

    info = api.get("nodeInfo") or {}
    assert info.get("deviceSplitCount") == 1
    assert info.get("virtualCardCount") == len(items)
    screenshot(gpu_page.page, "node201-xpu-exclusive-capacity")
