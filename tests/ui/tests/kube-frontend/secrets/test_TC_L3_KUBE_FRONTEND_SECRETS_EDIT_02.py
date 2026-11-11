from __future__ import annotations

import base64

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_EDIT_02(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-EDIT-02 编辑设置锁定类型并更新数据。"""

    name = e2e_objects["secret"](
        e2e_objects["unique"](), type_="kubernetes.io/basic-auth", data={"username": "robot", "password": "old"}
    )
    secrets_page.open()
    secrets_page.wait_for_row(name)
    secrets_page.open_row_menu(name)
    secrets_page.click_row_action("编辑设置")
    expect(secrets_page.dialog).to_be_visible()

    type_select = secrets_page.page.locator('[data-ai-id="secrets:field-type"] [role="combobox"]')
    expect(type_select).to_be_disabled()

    # A pair editor open blocks submit: a half-typed value is not in `data` yet.
    secrets_page.fill("secrets:field-password", "new-pass")
    secrets_page.click("secrets:edit-settings-submit")
    expect(secrets_page.dialog).to_have_count(0)

    obj = e2e_objects["get"]("secrets", name)
    assert obj["type"] == "kubernetes.io/basic-auth"
    assert base64.b64decode(obj["data"]["username"]).decode() == "robot"
    assert base64.b64decode(obj["data"]["password"]).decode() == "new-pass"
    screenshot(secrets_page.page, "list-basic-auth")
