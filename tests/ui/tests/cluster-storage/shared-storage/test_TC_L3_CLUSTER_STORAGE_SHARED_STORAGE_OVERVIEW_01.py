from __future__ import annotations

import pytest

from helpers.juicefs import first_number

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_OVERVIEW_01(storage_page):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01 四张卡片的数值与卷页表格一致。"""
    storage_page.open("overview")
    cards = {card["title"]: card["value"] for card in storage_page.cards}
    card_capacity = storage_page.card_bytes("总配额")
    card_used = storage_page.card_bytes("总已用")

    storage_page.open("volumes")
    rows = storage_page.table_rows

    assert int(first_number(cards["共享卷"])) == len(rows)

    total_capacity = sum(storage_page.row_bytes(i)["capacity"] for i in range(len(rows)))
    assert card_capacity == total_capacity, (
        f"总配额 {cards['总配额']} 与各行之和 {total_capacity} 不一致"
    )

    total_used = sum(storage_page.row_bytes(i)["used"] for i in range(len(rows)))
    assert card_used == total_used, (
        f"总已用 {cards['总已用']} 与各行之和 {total_used} 不一致"
    )

    busiest = max(
        (float(row[4].rstrip("%")) for row in rows if row[4].endswith("%")), default=0
    )
    assert first_number(cards["最高使用率"]) == pytest.approx(busiest, abs=0.2)
