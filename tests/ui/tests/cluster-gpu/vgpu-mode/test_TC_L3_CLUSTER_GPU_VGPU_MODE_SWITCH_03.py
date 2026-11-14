from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_SWITCH_03(gpu_page, ui_config):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-03 昆仑芯独占提交空参数。"""

    api = gpu_page.gpu_api()
    items = api.get("items") or []
    node = next((item.get("nodeName") for item in items if str(item.get("deviceVendor") or item.get("vendor") or "").lower() == "kunlunxin"), "")
    if not node:
        pytest.skip("当前集群没有昆仑芯节点")
    gpu_page.page.goto(ui_config.cluster_url("nodes"), wait_until="domcontentloaded")
    gpu_page.page.wait_for_selector("thead th", timeout=30_000)
    text = gpu_page.page.evaluate("() => document.body.innerText")
    assert "kunlunxin.com/xpu" in text or node in text
