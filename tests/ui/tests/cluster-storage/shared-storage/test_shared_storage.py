from __future__ import annotations

import re

import pytest

from helpers.contrast import audit, untranslated_keys

pytestmark = pytest.mark.ui


@pytest.mark.core
def test_core_entry(storage_page, screenshot):
    storage_page.open("overview")

    assert storage_page.page.title()
    assert storage_page.cards, "概览没有卡片"
    titles = [card["title"] for card in storage_page.cards]
    assert titles[:4] == ["共享卷", "总配额", "总已用", "最高使用率"], titles

    screenshot(storage_page.page, "core-overview")


@pytest.mark.full
def test_full_tabs(storage_page, screenshot):
    storage_page.open("overview")
    overview_rows = storage_page.usage_rows
    assert overview_rows, "概览没有使用率行"

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
    assert storage_page.table_rows, "卷页没有数据行"
    screenshot(storage_page.page, "full-volumes")

    storage_page.open("performance")
    # Either the six charts render, or the page says why it cannot (metrics off).
    assert storage_page.chart_titles or "指标未开启" in storage_page.body_text


@pytest.mark.point
def test_overview_numbers_match_volumes(storage_page):
    storage_page.open("overview")
    cards = {card["title"]: card["value"] for card in storage_page.cards}

    storage_page.open("volumes")
    rows = storage_page.table_rows
    # The quota column carries the human-readable value; the count must agree.
    assert int(re.sub(r"\D", "", cards["共享卷"]) or 0) == len(rows)


@pytest.mark.point
def test_overview_contrast_and_i18n(storage_page, ui_config, screenshot):
    storage_page.open("overview")
    violations = audit(storage_page.page, storage_page.content_selector, ui_config.contrast_text)
    screenshot(storage_page.page, "overview-contrast")
    assert violations == [], f"对比度不足：{violations[:5]}"

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"


@pytest.mark.point
def test_volumes_contrast_and_i18n(storage_page, ui_config, screenshot):
    storage_page.open("volumes")
    violations = audit(storage_page.page, storage_page.content_selector, ui_config.contrast_text)
    screenshot(storage_page.page, "volumes-contrast")
    assert violations == [], f"对比度不足：{violations[:5]}"

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"


@pytest.mark.point
def test_quota_dialog_validation(storage_page, screenshot):
    storage_page.open("volumes")
    storage_page.open_quota(0)

    initial = storage_page.quota_input.input_value()
    assert initial, "配额输入框为空"

    storage_page.quota_input.fill("1")
    storage_page.quota_unit.select_option("Gi")
    screenshot(storage_page.page, "quota-invalid")
    assert storage_page.quota_ok_disabled, "低于已用的值应当禁用确定"
    assert "不能低于" in storage_page.quota_dialog_text()

    storage_page.cancel_quota()


@pytest.mark.point
def test_performance_units_and_i18n(storage_page, ui_config, screenshot):
    storage_page.open("performance")
    text = storage_page.body_text
    screenshot(storage_page.page, "performance")

    assert "_PL" not in text, "出现未翻译的标题后缀 _PL"
    assert "_DESC" not in text
    # Storage throughput is bytes/s; Mbps would mean the bandwidth unit leaked in.
    assert not re.search(r"\d\s*Mbps", text), "读写的单位是 Mbps，应为 B/s 系"
    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"
