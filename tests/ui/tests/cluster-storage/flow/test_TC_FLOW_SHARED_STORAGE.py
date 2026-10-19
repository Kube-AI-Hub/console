from __future__ import annotations

import pytest

from helpers.juicefs import TIB, bytes_of, change_quota, restore_quota

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FLOW_SHARED_STORAGE(storage_page, screenshot):
    """TC-FLOW-SHARED_STORAGE 用户故事 US2 的旅程：发现快满 → 调大配额 → 概览与卷页都可见。"""
    storage_page.open("overview")
    capacity_before = storage_page.cards[1]["value"]
    assert storage_page.cards[3]["value"], "概览没有最高使用率"

    storage_page.click_tab("卷与配额")
    name, old, got = change_quota(storage_page)
    try:
        assert got == old + TIB
        screenshot(storage_page.page, "flow-quota")

        storage_page.click_tab("概览")
        capacity_after = storage_page.cards[1]["value"]
        assert bytes_of(capacity_after) > bytes_of(capacity_before), (
            "概览的总配额没有跟着涨"
        )
    finally:
        restore_quota(storage_page, name, old)
