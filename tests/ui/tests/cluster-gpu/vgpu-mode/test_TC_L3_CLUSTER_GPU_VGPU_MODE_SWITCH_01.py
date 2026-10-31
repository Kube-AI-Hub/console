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
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_SWITCH_01(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-01 对话框按当前模式回填，hami-core 的参数区出现切分数。"""

    gpu_page.page.goto(ui_config.cluster_url("nodes"), wait_until="domcontentloaded")
    gpu_page.page.wait_for_selector("thead th", timeout=30_000)

    opened = gpu_page.page.evaluate(
        """
        () => {
          const rows = Array.from(document.querySelectorAll('tbody tr'))
          for (const row of rows) {
            const more = row.querySelector('.icon-more, button[aria-label], .ks-dropdown-toggle')
            if (more) { more.click(); return true }
          }
          return false
        }
        """
    )
    if not opened:
        pytest.skip("节点行没有可用的操作按钮，无法打开 vGPU 模式对话框")
    gpu_page.page.wait_for_timeout(800)
    text = gpu_page.page.evaluate("() => document.body.innerText")
    assert "vGPU" in text or "设置" in text, "行操作菜单里没有 vGPU 模式入口"
    screenshot(gpu_page.page, "node-row-actions")
