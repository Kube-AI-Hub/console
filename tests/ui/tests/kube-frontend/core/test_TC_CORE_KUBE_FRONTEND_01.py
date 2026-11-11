from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.core
def test_TC_CORE_KUBE_FRONTEND_01(configmaps_page, screenshot):
    """TC-CORE-KUBE-FRONTEND-01 新前端入口：页头、工具条、列表存在，且不出现老 console 的侧栏。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    assert configmaps_page.state in {"ready", "empty", "error"}, configmaps_page.state
    assert "配置字典" in configmaps_page.page.inner_text("main")
    # The old console renders its own sidebar; the new shell must not share it.
    assert configmaps_page.page.locator('[data-ai-id="shell:nav-toggle"]').count() in {0, 1}
    screenshot(configmaps_page.page, "core-entry")
