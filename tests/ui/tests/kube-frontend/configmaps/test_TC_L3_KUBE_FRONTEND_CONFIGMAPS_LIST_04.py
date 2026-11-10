from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_04(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04 项目筛选：选中项目走该命名空间，全部项目去掉命名空间段。"""

    requests: list[str] = []
    configmaps_page.page.on("request", lambda request: requests.append(request.url))

    configmaps_page.open()
    configmaps_page.wait_ready()

    picker = configmaps_page.surface.get_by_role("combobox", name="项目")
    expect(picker).to_be_visible()

    # The filter must land on the request path, not on a query parameter kapis
    # would ignore.
    requests.clear()
    picker.click()
    option = configmaps_page.page.get_by_role("option").filter(has_not_text="全部项目").first
    if option.count() == 0:
        pytest.skip("项目列表为空，无法切换")
    target = option.inner_text().strip()
    option.click()
    configmaps_page.wait_ready()

    assert any(f"/namespaces/{target}/configmaps" in url for url in requests), requests[-3:]
    assert any("page=1" in url for url in requests), requests[-3:]

    screenshot(configmaps_page.page, "list-project-filter")
