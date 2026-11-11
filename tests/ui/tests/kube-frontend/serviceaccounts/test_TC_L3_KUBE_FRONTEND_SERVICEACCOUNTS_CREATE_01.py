from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_CREATE_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-01 创建时写入角色与描述。"""

    name = e2e_objects["unique"]() + "-sa"
    serviceaccounts_page.open()
    serviceaccounts_page.page.locator('[data-ai-id="serviceaccounts:create"]').click()
    expect(serviceaccounts_page.dialog).to_be_visible()

    serviceaccounts_page.fill("serviceaccounts:field-name", "Bad_Name")
    serviceaccounts_page.click("serviceaccounts:create-submit")
    expect(serviceaccounts_page.dialog.get_by_text("名称无效", exact=False)).to_be_visible()

    serviceaccounts_page.fill("serviceaccounts:field-name", name)
    serviceaccounts_page.fill("serviceaccounts:field-description", "E2E 创建")
    serviceaccounts_page.choose_role("viewer")
    serviceaccounts_page.click("serviceaccounts:create-submit")
    expect(serviceaccounts_page.dialog).to_have_count(0)
    expect(serviceaccounts_page.surface.locator(f'[data-ai-row="{name}"]')).to_be_visible()

    created = e2e_objects["get"]("serviceaccounts", name)
    annotations = created["metadata"].get("annotations", {})
    assert annotations["iam.kubesphere.io/role"] == "viewer"
    assert annotations["kubesphere.io/description"] == "E2E 创建"
    screenshot(serviceaccounts_page.page, "list-after-create")
