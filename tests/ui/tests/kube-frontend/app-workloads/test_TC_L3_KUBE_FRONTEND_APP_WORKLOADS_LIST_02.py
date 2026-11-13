from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02 工作负载列表：按名称搜索。"""

    ui = app_workloads_page
    token = ui.unique("search")
    first = f"{token}-searchable"
    second = f"{token}-other"
    try:
        ui.create_deployment(first, replicas=1)
        ui.create_deployment(second, replicas=1)
        ui.open("deployments")
        ui.ensure_row("deployments", first)
        ui.ensure_row("deployments", second)

        # The keyword must go upstream, not be applied inside the browser.
        urls: list[str] = []
        ui.page.on("request", lambda request: urls.append(request.url) if "/deployments?" in request.url else None)
        ui.search("deployments", "searchable")

        assert urls, "the keyword must be sent upstream"
        assert "name=searchable" in urls[-1], urls[-1]
        # A new search starts at page one, otherwise the reader lands on an empty page.
        assert "page=1" in urls[-1], urls[-1]

        expect(ui.row("deployments", second)).to_have_count(0, timeout=15_000)
        expect(ui.row("deployments", first)).to_be_visible()
        names = ui.row_names("deployments")
        assert first in names, names
        assert second not in names, names
        assert all("searchable" in item for item in names), names

        # Clearing the box restores the full first page.
        ui.search("deployments", "")
        ui.ensure_row("deployments", first)
        ui.ensure_row("deployments", second)
        screenshot(ui.page, "search")
    finally:
        ui.delete_deployment(first)
        ui.delete_deployment(second)
