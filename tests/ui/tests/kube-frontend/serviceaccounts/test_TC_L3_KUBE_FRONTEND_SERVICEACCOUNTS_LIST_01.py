from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_LIST_01(serviceaccounts_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01 列表列与角色显示。"""

    with_role = e2e_objects["service_account"](e2e_objects["unique"](), role="viewer")
    without_role = e2e_objects["service_account"](e2e_objects["unique"]())
    serviceaccounts_page.open()

    headers = serviceaccounts_page.headers
    assert headers[:5] == ["名称", "项目", "角色", "保密字典", "创建时间"], headers
    assert "viewer" in serviceaccounts_page.row_text(with_role)
    row = serviceaccounts_page.row(without_role)
    # The role cell stays empty; a placeholder would read like a role name.
    cells = [cell.strip() for cell in row.locator("td").all_inner_texts()]
    assert "viewer" not in " ".join(cells)
    screenshot(serviceaccounts_page.page, "list")
