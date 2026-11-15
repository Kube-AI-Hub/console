from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_CAPACITY_03(gpu_page, screenshot):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-CAPACITY-03 昆仑芯 hami-core 下列出 8 张卡且虚拟卡数为 32。"""

    api = gpu_page.gpu_api("node201-xpu")
    items = [
        item for item in (api.get("items") or [])
        if str(item.get("deviceVendor") or "").lower() == "kunlunxin"
    ]
    if not items:
        pytest.skip("node201-xpu 没有昆仑芯卡")
    modes = {item.get("mode") or "default" for item in items}
    if "hami-core" not in modes:
        pytest.skip(f"node201-xpu 不在 hami-core：{modes}")

    assert len(items) == 8
    for item in items:
        assert int(item.get("vgpuTotal") or 0) == 4
    info = api.get("nodeInfo") or {}
    assert info.get("virtualCardCount") == 32
    screenshot(gpu_page.page, "node201-xpu-hami-core-capacity")
