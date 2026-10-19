from __future__ import annotations

import pytest

from helpers.juicefs import TIB, bytes_of, change_quota, restore_quota

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_CLUSTER_STORAGE_SHARED_STORAGE_01(storage_page, screenshot):
    """TC-FULL-CLUSTER_STORAGE-SHARED_STORAGE-01 三个页签逐一点开；改一次配额后概览与卷页同步。"""
    storage_page.open("overview")
    assert storage_page.usage_rows, "概览没有使用率行"
    capacity_before = storage_page.cards[1]["value"]

    storage_page.click_tab("卷与配额")
    assert "juicefs-storage/volumes" in storage_page.page.url
    assert storage_page.table_headers[:7] == [
        "卷",
        "目录",
        "配额",
        "已用",
        "使用率",
        "inodes",
        "挂载节点",
    ], storage_page.table_headers
    assert storage_page.table_rows, "卷页没有数据行"
    screenshot(storage_page.page, "full-volumes")

    storage_page.click_tab("性能")
    assert "juicefs-storage/performance" in storage_page.page.url
    assert len(storage_page.chart_titles) == 6 or "指标未开启" in storage_page.body_text

    name, old, got = change_quota(storage_page)
    try:
        assert got == old + TIB, f"表格配额没有更新到 {old + TIB}，实际 {got}"
        storage_page.click_tab("概览")
        capacity_after = storage_page.cards[1]["value"]
        assert bytes_of(capacity_after) > bytes_of(capacity_before), (
            f"概览总配额没有跟着涨：{capacity_before} -> {capacity_after}"
        )
    finally:
        restore_quota(storage_page, name, old)
