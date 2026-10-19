from __future__ import annotations

import re

import pytest

from helpers.contrast import untranslated_keys

pytestmark = pytest.mark.ui

# The benchmark writes real data, so this test is opt-in: it is skipped unless the
# environment sets KA_RUN_BENCH=1. A default run must not push hundreds of MiB
# through a shared volume that other people are using.
RUN_BENCH = __import__("os").environ.get("KA_RUN_BENCH") == "1"


@pytest.mark.point
def test_TC_L3_CLUSTER_STORAGE_SHARED_STORAGE_PERFORMANCE_03(storage_page, screenshot):
    """TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-PERFORMANCE-03 主动触发读写测试：发起、进度、结果、切页签保留。"""
    storage_page.open("performance")

    volumes = storage_page.bench_volumes
    if not volumes:
        pytest.skip("没有可测试的共享卷")

    assert "开始测试" in storage_page.body_text

    if not RUN_BENCH:
        # Still check the panel is wired: the controls exist and the button is
        # enabled, without actually writing to the volume.
        assert storage_page.page.locator("select[name=bench-file-size]").count() == 1
        assert storage_page.page.locator("select[name=bench-threads]").count() == 1
        assert not storage_page.bench_running
        screenshot(storage_page.page, "bench-panel")
        pytest.skip("设置 KA_RUN_BENCH=1 才会真正发起测试（会写入 512 MiB）")

    storage_page.start_bench(256, 1)
    screenshot(storage_page.page, "bench-running")

    result = storage_page.wait_bench_done()
    screenshot(storage_page.page, "bench-result")

    for direction in ("write", "read"):
        assert result[direction], f"{direction} 吞吐为空"
        assert re.match(r"^[\d.]+ MiB/s$", result[direction]), result[direction]
        assert float(result[direction].split()[0]) > 0, f"{direction} 吞吐为 0"

    assert "s/file" in storage_page.body_text
    assert "页缓存" in storage_page.body_text

    # Leaving the tab and coming back must restore the run from GET /bench.
    storage_page.click_tab("卷与配额")
    storage_page.click_tab("性能")
    storage_page.page.wait_for_selector("[data-bench=write]", timeout=30_000)
    restored = storage_page.page.locator("[data-bench=write]").count()
    assert restored == 1, "切回性能页后结果丢失"

    keys = untranslated_keys(storage_page.page)
    assert keys == [], f"未翻译 key：{keys}"
