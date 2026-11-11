from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SERVICEACCOUNTS_SEARCH_01(serviceaccounts_page, e2e_objects):
    """TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-SEARCH-01 按名称搜索。"""

    name = e2e_objects["service_account"](e2e_objects["unique"]() + "-searchable")
    serviceaccounts_page.open()

    with serviceaccounts_page.page.expect_request(lambda request: "name=" in request.url and "page=1" in request.url):
        serviceaccounts_page.search("searchable")

    if serviceaccounts_page.state == "ready":
        names = serviceaccounts_page.row_names()
        assert all("searchable" in item for item in names), names
    assert name in serviceaccounts_page.row_names()
