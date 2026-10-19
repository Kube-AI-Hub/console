from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_PERFORMANCE_02(storage_page, screenshot):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-02 空闲区间：读写图给出空态文案，而不是一条零线。"""
    storage_page.open("performance")
    if "指标未开启" in storage_page.body_text:
        pytest.skip("客户端指标未开启，空态无从判断")

    empties = storage_page.empty_charts
    screenshot(storage_page.page, "performance-idle")

    if not empties:
        # There is traffic in the window: the empty state does not apply, but the
        # charts must still be drawn.
        assert storage_page.chart_curves > 0, "有数据却没有画出曲线"
        pytest.skip("当前区间有流量，空态不适用")

    assert any("无读写" in item for item in empties), empties
    # An empty throughput chart must not also draw a zero line.
    assert storage_page.chart_curves < 6, "空闲的吞吐图仍在画曲线"
