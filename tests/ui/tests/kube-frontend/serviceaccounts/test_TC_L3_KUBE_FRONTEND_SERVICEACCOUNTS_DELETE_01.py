from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_DELETE_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-DELETE-01 输入名称确认后删除。"""

    name = e2e_objects["service_account"](e2e_objects["unique"]())
    serviceaccounts_page.open()
    serviceaccounts_page.open_row_menu(name)
    serviceaccounts_page.click_row_action("删除")

    confirm = serviceaccounts_page.page.locator('[data-ai-id="serviceaccounts:delete-confirm"]')
    expect(confirm).to_be_disabled()
    serviceaccounts_page.fill("serviceaccounts:delete-input", name[:-1])
    expect(confirm).to_be_disabled()
    serviceaccounts_page.fill("serviceaccounts:delete-input", name)
    expect(confirm).to_be_enabled()
    confirm.click()

    expect(serviceaccounts_page.surface.locator(f'[data-ai-row="{name}"]')).to_have_count(0)
    assert e2e_objects["get"]("serviceaccounts", name)["__status"] == 404
    screenshot(serviceaccounts_page.page, "list-after-delete")
