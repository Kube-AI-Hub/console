from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_CREATE_01(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-CREATE-01 创建保密字典：名称与项目校验。"""

    existing = e2e_objects["secret"](e2e_objects["unique"]())
    # The duplicate check runs a GET against `/api/v1`; let the api-server's view
    # settle so the assertion is about the page, not about a race with creation.
    e2e_objects["get"]("secrets", existing)
    secrets_page.open()
    secrets_page.create_button.click()
    expect(secrets_page.dialog).to_be_visible()

    secrets_page.fill("secrets:field-name", "Bad_Name")
    secrets_page.click("secrets:create-next")
    expect(secrets_page.dialog.get_by_text("名称无效", exact=False)).to_be_visible()
    # Still on the basic step: no data editor yet.
    expect(secrets_page.page.locator('[data-ai-id="secrets:data-add"]')).to_have_count(0)

    secrets_page.fill("secrets:field-name", existing)
    secrets_page.click("secrets:create-next")
    # A name check against a just-created object can be slow on a cold cluster; the
    # default 5s is a budget for a warm path, not for correctness.
    expect(secrets_page.dialog.get_by_text("名称已存在，请输入其他名称。")).to_be_visible(timeout=15_000)
    screenshot(secrets_page.page, "create-name-taken")
