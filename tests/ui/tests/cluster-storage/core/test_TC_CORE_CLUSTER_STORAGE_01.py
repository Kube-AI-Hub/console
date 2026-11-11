from __future__ import annotations

import pytest

from helpers.contrast import untranslated_keys

pytestmark = pytest.mark.ui


@pytest.mark.core
def test_TC_CORE_CLUSTER_STORAGE_01(storage_page, screenshot):
    """TC-CORE-CLUSTER-STORAGE-01 入口：标题、三个页签、概览卡片、无未翻译 key。"""
    storage_page.open("overview")

    assert storage_page.page.title()
    assert storage_page.tabs == ["概览", "卷与配额", "性能"], storage_page.tabs

    titles = [card["title"] for card in storage_page.cards]
    assert titles[:4] == ["共享卷", "总配额", "总已用", "最高使用率"], titles
    assert all(card["value"] for card in storage_page.cards[:4]), storage_page.cards

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"

    screenshot(storage_page.page, "core-overview")
