from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_ROLE_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-ROLE-01 修改角色。"""

    name = e2e_objects["service_account"](e2e_objects["unique"](), role="viewer")
    serviceaccounts_page.open()
    serviceaccounts_page.open_row_menu(name)

    with serviceaccounts_page.page.expect_request(lambda request: request.method == "PATCH" and "/serviceaccounts/" in request.url) as request_info:
        serviceaccounts_page.click_row_action("修改角色")
        expect(serviceaccounts_page.dialog).to_be_visible()
        # The picker starts on the current role.
        serviceaccounts_page.page.locator('[data-ai-id="serviceaccounts:role-select"] [role="combobox"]').click()
        serviceaccounts_page.page.get_by_role("option", name="operator", exact=True).click()
        serviceaccounts_page.page.locator('[data-ai-id="serviceaccounts:role-submit"]').click()
        expect(serviceaccounts_page.dialog).to_have_count(0)

    headers = {key.lower(): value for key, value in request_info.value.headers.items()}
    assert headers.get("content-type") == "application/merge-patch+json", headers

    obj = e2e_objects["get"]("serviceaccounts", name)
    assert obj["metadata"]["annotations"]["iam.kubesphere.io/role"] == "operator"
    expect(serviceaccounts_page.row(name)).to_contain_text("operator")
    screenshot(serviceaccounts_page.page, "list-after-role")
