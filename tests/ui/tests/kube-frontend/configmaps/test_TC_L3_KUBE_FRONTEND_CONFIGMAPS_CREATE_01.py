from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_CREATE_01(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01 创建：名称格式与重名校验拦住下一步。"""

    # The list is empty on a fresh cluster; seed two objects so the case does
    # not depend on whatever happens to be deployed.
    seeded_configmaps["create"]("case-a", {"key-a": "1"})
    seeded_configmaps["create"]("case-b", {"key-b": "2"})
    # The duplicate-name case needs a name that certainly exists. Use the name the
    # fixture actually created (it is prefixed per run/test so parallel workers do not
    # share objects) rather than a fixed literal.
    existing = seeded_configmaps["create"]("app-config", {"app.yaml": "a: 1"})

    configmaps_page.open()
    configmaps_page.wait_ready()
    configmaps_page.create_button.click()

    configmaps_page.fill_dialog_field("configmaps:field-name", "Bad_Name")
    configmaps_page.confirm_dialog("configmaps:create-next")
    expect(configmaps_page.dialog.get_by_text("名称无效")).to_be_visible()

    configmaps_page.fill_dialog_field("configmaps:field-name", existing)
    # The duplicate check is a request against the server, and the next-step button waits
    # for it. Under parallel load that answer can land after the first click has already
    # been swallowed, so retry: clicking again after the check has resolved is what a
    # person does too.
    duplicate_hint = configmaps_page.dialog.get_by_text("名称已存在，请输入其他名称。")
    for _ in range(6):
        configmaps_page.confirm_dialog("configmaps:create-next")
        try:
            expect(duplicate_hint).to_be_visible(timeout=8_000)
            break
        except AssertionError:
            configmaps_page.page.wait_for_timeout(1_000)
    expect(duplicate_hint).to_be_visible(timeout=20_000)

    screenshot(configmaps_page.page, "create-name-validation")