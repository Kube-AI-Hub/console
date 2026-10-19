from __future__ import annotations

import re

import pytest

from helpers.contrast import untranslated_keys

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_PERFORMANCE_01(
    storage_page, ui_config, screenshot
):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-01 性能页：六张图、单位正确、区间合计、无未翻译 key。"""
    storage_page.open("performance")
    text = storage_page.body_text
    screenshot(storage_page.page, "performance")

    if "指标未开启" in text:
        # AC-PERFORMANCE-04: explain how to enable it, do not show empty charts.
        assert "metricsAddr" in text or "9567" in text, "指标未开启时缺少开启方法"
        return

    assert storage_page.chart_titles == [
        "读吞吐",
        "写吞吐",
        "块缓存命中率",
        "缓存读延迟",
        "FUSE 操作延迟",
        "对象存储错误",
    ], storage_page.chart_titles

    # Throughput is bytes/s; Mbps would mean the bandwidth unit leaked in.
    assert not re.search(r"\d\s*Mbps", text), "读写的单位是 Mbps，应为 B/s 系"

    # Latency, ratio and error charts render a unit next to their current value.
    assert re.search(r"(?:\d+(\.\d+)?|-)\s*(?:ms|s)\b", text), "延迟缺少 s/ms 单位"
    assert "%" in text, "命中率缺少 % 单位"
    assert "次/秒" in text, "对象存储错误的单位不是次/秒"

    # Throughput units only appear when there is traffic; an idle chart says so
    # instead of drawing a zero line.
    if not any("无读写" in item for item in storage_page.empty_charts):
        assert re.search(r"(B/s|KiB/s|MiB/s|GiB/s)", text), "读写的单位不是 B/s 系"

    # The range total is what makes an idle window explainable, so it must be there
    # even when the series is all zeros.
    assert "区间合计" in text, "标题里没有区间合计"

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"
