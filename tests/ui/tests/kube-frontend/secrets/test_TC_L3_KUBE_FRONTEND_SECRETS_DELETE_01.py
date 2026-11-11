from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_DELETE_01(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-DELETE-01 输入名称确认后删除。"""

    first = e2e_objects["secret"](e2e_objects["unique"]())
    second = e2e_objects["secret"](e2e_objects["unique"]())
    secrets_page.open()

    secrets_page.open_row_menu(first)
    secrets_page.click_row_action("删除")
    confirm = secrets_page.page.locator('[data-ai-id="secrets:delete-confirm"]')
    expect(confirm).to_be_disabled()

    secrets_page.fill("secrets:delete-input", first[:-1])
    expect(confirm).to_be_disabled()
    secrets_page.fill("secrets:delete-input", first)
    expect(confirm).to_be_enabled()
    confirm.click()

    expect(secrets_page.surface.locator(f'[data-ai-row="{first}"]')).to_have_count(0)
    assert e2e_objects["get"]("secrets", first)["__status"] == 404

    # A bulk confirmation requires every name.
    secrets_page.open_row_menu(second)
    secrets_page.click_row_action("删除")
    secrets_page.fill("secrets:delete-input", second)
    secrets_page.page.locator('[data-ai-id="secrets:delete-confirm"]').click()
    expect(secrets_page.surface.locator(f'[data-ai-row="{second}"]')).to_have_count(0)
    assert e2e_objects["get"]("secrets", second)["__status"] == 404
    screenshot(secrets_page.page, "list-after-delete")
