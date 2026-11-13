from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_LIST_02(storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-LIST-02 存储：空项目不渲染表头。"""

    ui = storage_page
    # A namespace with no claims at all; if one appears, the case cannot say
    # anything, so it says so instead of asserting on a page that should not be empty.
    ui.open("persistentvolumeclaims", "kube-frontend-demo")
    ui.wait_ready("persistentvolumeclaims")

    surface = ui.surface("persistentvolumeclaims")
    if surface.get_attribute("data-ai-state") != "empty":
        pytest.skip("kube-frontend-demo 已经有存储卷，无法验证空态")

    assert surface.locator("thead").count() == 0, "empty list must not render a header row"
    text = surface.inner_text()
    assert "暂无存储卷" in text, text
    screenshot(ui.page, "storage-empty")
