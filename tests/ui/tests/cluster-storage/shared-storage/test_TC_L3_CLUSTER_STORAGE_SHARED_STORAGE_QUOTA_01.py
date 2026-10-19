from __future__ import annotations

import re

import pytest

from helpers.contrast import audit, untranslated_keys

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_QUOTA_01(
    storage_page, ui_config, screenshot
):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-01 卷页八列齐全、嵌套卷有标注、每行有操作按钮、文字可读。"""
    storage_page.open("volumes")

    headers = storage_page.table_headers
    assert headers[:7] == [
        "卷",
        "目录",
        "配额",
        "已用",
        "使用率",
        "inodes",
        "挂载节点",
    ], headers

    rows = storage_page.table_rows
    assert rows, "卷页没有数据行"
    for row in rows:
        assert re.search(r"[\d.]+ (GiB|TiB|PiB)", row[2]), f"配额不是人类可读单位：{row[2]}"
        assert row[3], f"已用为空：{row}"
        assert row[4].endswith("%"), f"使用率不是百分比：{row[4]}"
        assert re.match(r"\d+ / \d+", row[5]), f"inodes 格式不对：{row[5]}"
    assert storage_page.quota_buttons == len(rows), "不是每一行都有操作按钮"

    nested = [row for row in rows if "位于" in row[1]]
    if nested:
        assert re.search(r"位于 .+ 内", nested[0][1]), nested[0][1]

    violations = audit(
        storage_page.page, storage_page.content_selector, ui_config.contrast_text
    )
    screenshot(storage_page.page, "volumes-contrast")
    assert violations == [], f"对比度不足：{violations[:5]}"

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"
