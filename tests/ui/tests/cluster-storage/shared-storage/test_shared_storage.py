from __future__ import annotations

import re

import pytest

from helpers.contrast import audit, untranslated_keys

pytestmark = pytest.mark.ui

# One test per spec, named after the spec id, so `tests/_meta/test_spec_coverage.py`
# can check the mapping mechanically.
#
# Specs: tests/ui/specs/cluster-storage/**/TC-*.yaml
#
# The quota tests are the only ones that write. They change the first row's quota
# by +1 TiB and put it back in a finally block, so a failed assertion does not
# leave the cluster with a different capacity than the one it started with.

TIB = 1024 ** 4


def _bytes(text: str) -> float:
    """Parse `5.0 TiB` / `1012.7 GiB` into bytes (display text is rounded)."""
    match = re.match(r"([\d.]+)\s*(B|KiB|MiB|GiB|TiB|PiB)", text.strip())
    if not match:
        return 0.0
    value = float(match.group(1))
    power = {"B": 0, "KiB": 1, "MiB": 2, "GiB": 3, "TiB": 4, "PiB": 5}[match.group(2)]
    return value * 1024 ** power


def _first_number(text: str) -> float:
    match = re.search(r"[\d.]+", text.replace(",", ""))
    return float(match.group(0)) if match else 0.0


def _change_quota(storage_page, delta_tib: int = 1) -> tuple[str, int, int]:
    """Grow the first row's quota by `delta_tib` through the dialog.

    Returns (volume name, old bytes, new bytes). The caller is responsible for
    restoring the old value.
    """
    storage_page.open("volumes")
    name = storage_page.volume_name(0)
    old = storage_page.row_bytes(0)["capacity"]
    target = old + delta_tib * TIB

    storage_page.open_quota(0)
    storage_page.quota_input.fill(str(target // TIB))
    storage_page.quota_unit.select_option("Ti")
    storage_page.submit_quota()

    got = storage_page.wait_row_capacity(target)
    return name, old, got


def _restore_quota(storage_page, name: str, old_bytes: int) -> None:
    if not name or not old_bytes:
        return
    # The API takes ~10s; the page does not need to be open for it.
    storage_page.set_quota_api(name, f"{old_bytes // TIB}Ti")
    storage_page.page.wait_for_timeout(500)


# ---------------------------------------------------------------- L1 core


@pytest.mark.core
def test_TC_CORE_CLUSTER_STORAGE_01(storage_page, screenshot):
    """入口：标题、三个页签、概览卡片、无未翻译 key。"""
    storage_page.open("overview")

    assert storage_page.page.title()
    assert storage_page.tabs == ["概览", "卷与配额", "性能"], storage_page.tabs

    titles = [card["title"] for card in storage_page.cards]
    assert titles[:4] == ["共享卷", "总配额", "总已用", "最高使用率"], titles
    assert all(card["value"] for card in storage_page.cards[:4]), storage_page.cards

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"

    screenshot(storage_page.page, "core-overview")


# ---------------------------------------------------------------- L2 full


@pytest.mark.full
def test_TC_FULL_CLUSTER_STORAGE_SHARED_STORAGE_01(storage_page, screenshot):
    """三个页签逐一点开；改一次配额后概览与卷页同步。"""
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

    name, old, got = _change_quota(storage_page)
    try:
        assert got == old + TIB, f"表格配额没有更新到 {old + TIB}，实际 {got}"
        storage_page.click_tab("概览")
        capacity_after = storage_page.cards[1]["value"]
        assert _bytes(capacity_after) > _bytes(capacity_before), (
            f"概览总配额没有跟着涨：{capacity_before} -> {capacity_after}"
        )
    finally:
        _restore_quota(storage_page, name, old)


# ---------------------------------------------------------------- L3 overview


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_OVERVIEW_01(storage_page):
    """四张卡片的数值与卷页表格一致。"""
    storage_page.open("overview")
    cards = {card["title"]: card["value"] for card in storage_page.cards}
    card_capacity = storage_page.card_bytes("总配额")
    card_used = storage_page.card_bytes("总已用")

    storage_page.open("volumes")
    rows = storage_page.table_rows

    assert int(_first_number(cards["共享卷"])) == len(rows)

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
    assert _first_number(cards["最高使用率"]) == pytest.approx(busiest, abs=0.2)


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_OVERVIEW_02(storage_page, ui_config, screenshot):
    """概览可读：对比度达标、无未翻译 key、配额待刷新有提示。"""
    storage_page.open("overview")
    violations = audit(storage_page.page, storage_page.content_selector, ui_config.contrast_text)
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


# ---------------------------------------------------------------- L3 quota


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_QUOTA_01(storage_page, ui_config, screenshot):
    """卷页八列齐全、嵌套卷有标注、每行有操作按钮、文字可读。"""
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

    violations = audit(storage_page.page, storage_page.content_selector, ui_config.contrast_text)
    screenshot(storage_page.page, "volumes-contrast")
    assert violations == [], f"对比度不足：{violations[:5]}"

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_QUOTA_02(storage_page, screenshot):
    """配额弹窗：初始值、下限校验、取消不变、提交生效。"""
    storage_page.open("volumes")
    name = storage_page.volume_name(0)
    before = storage_page.row_bytes(0)["capacity"]

    storage_page.open_quota(0)
    initial = storage_page.quota_input.input_value()
    unit = storage_page.quota_unit.input_value()
    assert initial, "配额输入框为空"
    expected_bytes = float(initial) * (TIB if unit == "Ti" else 1024 ** 3)
    assert expected_bytes == pytest.approx(before, rel=0.01), (
        f"初始值 {initial}{unit} 与当前配额 {before} 不一致"
    )

    # Below the used bytes: the dialog must block submission and say why.
    storage_page.quota_input.fill("1")
    storage_page.quota_unit.select_option("Gi")
    screenshot(storage_page.page, "quota-invalid")
    assert storage_page.quota_ok_disabled, "低于已用的值应当禁用确定"
    assert "不能低于" in storage_page.quota_dialog_text()

    storage_page.cancel_quota()
    storage_page.page.wait_for_timeout(500)
    assert storage_page.row_bytes(0)["capacity"] == before, "取消后配额不应变化"

    try:
        target = before + TIB
        storage_page.open_quota(0)
        storage_page.quota_input.fill(str(target // TIB))
        storage_page.quota_unit.select_option("Ti")
        storage_page.submit_quota()
        got = storage_page.wait_row_capacity(target)
        assert got == target, f"提交后配额应为 {target}，实际 {got}"
    finally:
        _restore_quota(storage_page, name, before)


# ---------------------------------------------------------------- L3 performance


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_PERFORMANCE_01(storage_page, ui_config, screenshot):
    """性能页：六张图、单位正确、区间合计、无未翻译 key。"""
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


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_PERFORMANCE_02(storage_page, screenshot):
    """空闲区间：读写图给出空态文案，而不是一条零线。"""
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


# ---------------------------------------------------------------- flow


@pytest.mark.full
def test_TC_FLOW_SHARED_STORAGE(storage_page, screenshot):
    """用户故事 US2 的旅程：发现快满 → 调大配额 → 概览与卷页都可见。"""
    storage_page.open("overview")
    capacity_before = storage_page.cards[1]["value"]
    assert storage_page.cards[3]["value"], "概览没有最高使用率"

    storage_page.click_tab("卷与配额")
    name, old, got = _change_quota(storage_page)
    try:
        assert got == old + TIB
        screenshot(storage_page.page, "flow-quota")

        storage_page.click_tab("概览")
        capacity_after = storage_page.cards[1]["value"]
        assert _bytes(capacity_after) > _bytes(capacity_before), (
            "概览的总配额没有跟着涨"
        )
    finally:
        _restore_quota(storage_page, name, old)
