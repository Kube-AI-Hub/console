from __future__ import annotations

import pytest

from helpers.contrast import audit, untranslated_keys

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_OVERVIEW_02(
    storage_page, ui_config, screenshot
):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02 概览可读：对比度达标、无未翻译 key、配额待刷新有提示。"""
    storage_page.open("overview")
    violations = audit(
        storage_page.page, storage_page.content_selector, ui_config.contrast_text
    )
    screenshot(storage_page.page, "overview-contrast")
    assert violations == [], f"对比度不足：{violations[:5]}"

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"

    # A volume whose statfs disagrees with its PV quota is flagged in the table; the
    # overview hint must then say which number to trust. (The banner description
    # mentions the phrase in general, so only pair the two when a row is flagged.)
    storage_page.open("volumes")
    flagged = [row for row in storage_page.table_rows if "待刷新" in row[2]]
    storage_page.open("overview")
    if flagged:
        assert "以配额列为准" in storage_page.body_text, (
            "卷页标了待刷新，概览却没有说明以哪个数为准"
        )
