from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_04(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04 用户列表：按名称排序可切换升降序。"""

    ui = access_control_page
    ui.open("users")
    ui.wait_ready("users")

    surface = ui.surface("users")

    def names() -> list[str]:
        return [text.strip() for text in surface.locator("[data-ai-row]").evaluate_all(
            "els => els.map(el => el.getAttribute('data-ai-row'))"
        )]

    initial = names()
    if len(initial) < 2:
        pytest.skip("用户列表不足两条，无法比较排序")

    sorter = ui.page.locator('[data-ai-id="users:sort:name"]')
    sorter.click()
    ui.page.wait_for_timeout(2500)
    first = names()
    sorter.click()
    ui.page.wait_for_timeout(2500)
    second = names()

    # The two clicks must land on different orders. Default list sort is createTime,
    # so the first name-column click must actually switch the key (not be a no-op).
    assert first != second, (initial, first, second)
    assert first == sorted(first), first
    assert second == sorted(second, reverse=True), second
    screenshot(ui.page, "access-users-sort")
