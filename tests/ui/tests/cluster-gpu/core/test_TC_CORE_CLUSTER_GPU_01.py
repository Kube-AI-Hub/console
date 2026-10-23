from __future__ import annotations

import re

import pytest

from helpers.contrast import untranslated_keys

pytestmark = pytest.mark.ui


@pytest.mark.core
def test_TC_CORE_CLUSTER_GPU_01(gpu_page, ui_config, screenshot):
    """TC-CORE-CLUSTER_GPU-01 集群算力入口可打开，显卡列表与健康比例可见，无未翻译 key。"""
    gpu_page.open_cluster()

    text = gpu_page.body_text
    assert "显卡" in text, "页面标题里没有「显卡」"
    assert "显卡健康状态" in text, "概览条没有显卡健康状态"
    # The overview renders the healthy/total pair and the ratio, e.g. "14/15" and "93.3%".
    assert re.search(r"\d+/\d+", text), "概览条没有健康/总数"
    assert re.search(r"\d+(\.\d+)?%", text), "概览条没有健康比例"

    headers = gpu_page.cluster_headers
    for expected in ("节点", "序号", "显卡 ID", "状态", "型号", "NUMA 节点", "厂商"):
        assert expected in headers, f"表头缺 {expected}：{headers}"

    rows = gpu_page.cluster_rows
    assert rows, "显卡列表没有数据行"
    for row in rows:
        assert row["status"] in ("健康", "亚健康"), f"状态文本异常：{row}"
        assert row["uuid"].startswith("GPU-"), f"UUID 列不是单份 UUID：{row['uuid']}"

    screenshot(gpu_page.page, "gpus-overview")

    keys = untranslated_keys(gpu_page.page)
    assert keys == [], f"未翻译 key：{keys}"
