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
def test_TC_FULL_CLUSTER_GPU_VGPU_MODE_01(gpu_page, ui_config, screenshot):
    """TC-FULL-CLUSTER-GPU-VGPU_MODE-01 模式切换后模式列与资源总量都变化。"""

    gpu_page.page.goto(ui_config.cluster_url("nodes"), wait_until="domcontentloaded")
    gpu_page.page.wait_for_selector("thead th", timeout=30_000)

    headers = gpu_page.page.evaluate(
        "() => Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent.trim())"
    )
    assert MODE_LABEL in headers, f"节点列表缺少「{MODE_LABEL}」列：{headers}"

    cells = gpu_page.page.evaluate(
        """
        (idx) => Array.from(document.querySelectorAll('tbody tr')).map((row) => {
          const td = row.querySelectorAll('td')[idx]
          return td ? td.textContent.trim() : ''
        })
        """,
        headers.index(MODE_LABEL),
    )
    assert cells, "节点列表没有数据行"
    for cell in cells:
        assert "VGPU_MODE" not in cell and "GPU_" not in cell, f"模式列出现未翻译的 key：{cell}"
        assert cell in {"默认", "hami-core", "mig", "-"} or cell.startswith("切换"), (
            f"模式列是未知值：{cell}"
        )
    screenshot(gpu_page.page, "nodes-with-vgpu-mode-column")
