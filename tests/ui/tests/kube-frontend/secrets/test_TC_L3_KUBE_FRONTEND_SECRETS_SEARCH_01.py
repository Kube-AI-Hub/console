from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_SEARCH_01(secrets_page, e2e_objects):
    """TC-L3-KUBE-FRONTEND-SECRETS-SEARCH-01 保密字典：按名称搜索。"""

    name = e2e_objects["unique"]() + "-searchable"
    e2e_objects["secret"](name)
    secrets_page.open()

    urls: list[str] = []
    secrets_page.page.on("request", lambda request: urls.append(request.url) if "name=" in request.url else None)
    secrets_page.search("searchable")

    assert urls, "the keyword must be sent upstream, not applied in the browser"
    # A new search starts at page one, otherwise the reader lands on an empty page.
    assert "page=1" in urls[-1], urls[-1]

    if secrets_page.state == "ready":
        names = secrets_page.row_names()
        assert names, "search returned no rows but the list is not empty"
        assert all("searchable" in item for item in names), names
        assert name in names

    secrets_page.search("")
    assert name in secrets_page.row_names()
