from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_PLATFORM_ROLES_03(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-03 平台角色列表：分页可寻址且可前后翻页。"""

    ui = access_control_page
    ui.open("clusterroles")
    ui.wait_ready("clusterroles")

    def names() -> list[str]:
        return ui.page.evaluate(
            """() => {
                const surface = document.querySelector('[data-ai-id="clusterroles:surface"]');
                if (!surface) return [];
                return Array.from(surface.querySelectorAll('[data-ai-row]')).map((el) => el.getAttribute('data-ai-row'));
            }"""
        )

    # The pager belongs to the list, so it carries the same prefix as the rows instead of
    # being addressable only by its translated label.
    next_page = ui.page.locator('[data-ai-id="clusterroles:page:next"]')
    prev_page = ui.page.locator('[data-ai-id="clusterroles:page:prev"]')
    expect(next_page).to_be_visible()
    expect(prev_page).to_be_visible()

    if not next_page.is_enabled():
        pytest.skip("平台角色只有一页，无法验证翻页")

    first = names()
    next_page.click()
    ui.page.wait_for_timeout(2500)
    expect(ui.surface("clusterroles")).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    second = names()
    assert second and second != first, (first[:3], second[:3])

    prev_page.click()
    ui.page.wait_for_timeout(2500)
    expect(ui.surface("clusterroles")).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert names() == first
    screenshot(ui.page, "access-roles-pagination")
