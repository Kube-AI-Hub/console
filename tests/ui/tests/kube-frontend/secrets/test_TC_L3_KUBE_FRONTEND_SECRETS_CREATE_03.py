from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_CREATE_03(secrets_page, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-CREATE-03 创建保密字典：切换类型清空数据与 YAML 模式。"""

    secrets_page.open()
    secrets_page.create_button.click()
    secrets_page.fill("secrets:field-name", "tc-e2e-yaml-mode")
    secrets_page.click("secrets:create-next")

    expect(secrets_page.page.get_by_text("切换类型会清空已填写的数据。")).to_be_visible()
    secrets_page.click("secrets:data-add")
    secrets_page.fill("secrets:data-key", "password")
    secrets_page.fill("secrets:data-value", "x")
    secrets_page.click("secrets:data-save")
    expect(secrets_page.page.get_by_text("password", exact=True)).to_be_visible()

    secrets_page.choose_type("TLS 信息")
    expect(secrets_page.page.locator('[data-ai-id="secrets:field-tls-crt"]')).to_be_visible()
    expect(secrets_page.page.get_by_text("password", exact=True)).to_have_count(0)

    secrets_page.click("secrets:create-yaml-mode")
    editor = secrets_page.page.locator('[role="dialog"] .cm-content').first
    expect(editor).to_be_visible()
    content = editor.inner_text()
    assert "name: tc-e2e-yaml-mode" in content
    assert "type: kubernetes.io/tls" in content
    screenshot(secrets_page.page, "create-yaml")
