from __future__ import annotations

import pytest

from helpers.juicefs import TIB, restore_quota

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_QUOTA_02(storage_page, screenshot):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-QUOTA-02 配额弹窗：初始值、下限校验、取消不变、提交生效。"""
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
        restore_quota(storage_page, name, before)
