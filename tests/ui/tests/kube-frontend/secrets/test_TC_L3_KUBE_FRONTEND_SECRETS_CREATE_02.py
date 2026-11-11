from __future__ import annotations

import base64

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_CREATE_02(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-CREATE-02 创建保密字典：必填与 UTF-8 编码。"""

    name = e2e_objects["unique"]() + "-basic"
    # Registered for unconditional cleanup; the UI is what creates it.
    secrets_page.open()
    secrets_page.create_button.click()
    secrets_page.fill("secrets:field-name", name)
    secrets_page.click("secrets:create-next")

    secrets_page.choose_type("用户名和密码")
    secrets_page.click("secrets:create-submit")
    expect(secrets_page.page.get_by_text("请填写当前类型要求的数据项。")).to_be_visible()

    password = "p@ss 中文"
    secrets_page.fill("secrets:field-username", "robot")
    secrets_page.fill("secrets:field-password", password)
    secrets_page.click("secrets:create-submit")
    # The dialog closes once the create mutation settles; give the round trip room
    # rather than the default 5s, which a loaded cluster can exceed.
    expect(secrets_page.dialog).to_have_count(0, timeout=15_000)
    expect(secrets_page.surface.locator(f'[data-ai-row="{name}"]')).to_be_visible()

    created = e2e_objects["get"]("secrets", name)
    data = created.get("data", {})
    assert base64.b64decode(data["username"]).decode("utf-8") == "robot"
    assert base64.b64decode(data["password"]).decode("utf-8") == password
    assert created["type"] == "kubernetes.io/basic-auth"
    screenshot(secrets_page.page, "create-basic")
