from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

ROLE_ANNOTATION = "iam.kubesphere.io/role"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_CREATE_02(serviceaccounts_page, e2e_objects):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-CREATE-02 不设置角色与切换项目。"""

    name = e2e_objects["unique"]() + "-sa-norole"
    serviceaccounts_page.open()
    serviceaccounts_page.page.locator('[data-ai-id="serviceaccounts:create"]').click()
    serviceaccounts_page.fill("serviceaccounts:field-name", name)
    # The default option is 不设置: no role is written at all.
    serviceaccounts_page.click("serviceaccounts:create-submit")
    expect(serviceaccounts_page.dialog).to_have_count(0)

    created = e2e_objects["get"]("serviceaccounts", name)
    assert ROLE_ANNOTATION not in created["metadata"].get("annotations", {})
