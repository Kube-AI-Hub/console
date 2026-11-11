from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_EDIT_01(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-EDIT-01 编辑信息只改别名与描述。"""

    name = e2e_objects["secret"](e2e_objects["unique"](), data={"password": "keep"}, annotations={"kubesphere.io/creator": "admin"})
    secrets_page.open()
    secrets_page.wait_for_row(name)
    secrets_page.open_row_menu(name)
    secrets_page.click_row_action("编辑信息")
    expect(secrets_page.dialog).to_be_visible()

    name_input = secrets_page.dialog.locator("input").first
    expect(name_input).to_be_disabled()
    secrets_page.fill("secrets:edit-alias", "别名-edit")
    secrets_page.fill("secrets:edit-description", "改过的描述")
    secrets_page.click("secrets:edit-info-submit")
    expect(secrets_page.dialog).to_have_count(0)

    obj = e2e_objects["get"]("secrets", name)
    annotations = obj["metadata"]["annotations"]
    assert annotations["kubesphere.io/alias-name"] == "别名-edit"
    assert annotations["kubesphere.io/description"] == "改过的描述"
    assert annotations["kubesphere.io/creator"] == "admin"
    assert obj["data"], "data must survive an information edit"
    # The list shows the alias in place of the name, as the old console does.
    expect(secrets_page.row(name)).to_contain_text("别名-edit")
    screenshot(secrets_page.page, "list-after-alias")
