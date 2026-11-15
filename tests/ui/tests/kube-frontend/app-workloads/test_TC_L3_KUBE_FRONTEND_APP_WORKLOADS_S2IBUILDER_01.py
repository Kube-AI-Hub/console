from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_01(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01 镜像构建器列表：服务端分页/搜索/刷新/列。"""

    ui = image_builder_page
    suffix = ui.unique()
    name_a = f"{suffix}-a"
    name_b = f"{suffix}-b"
    try:
        assert ui.create_builder(name_a, display_name="列表甲", service_name="tc-e2e-svc") == 201
        assert ui.create_builder(name_b, display_name="列表乙") == 201

        requests: list[str] = []
        ui.page.on("request", lambda request: requests.append(f"{request.method} {request.url}"))

        ui.open_list()
        surface = ui.surface()
        expect(surface).to_be_visible()
        ui.wait_ready()

        headers = ui.headers()
        for column in ("名称", "状态", "创建时间"):
            assert column in headers, headers

        # Both rows are found by search, so the assertion does not depend on which page
        # the freshly created objects land on.
        ui.ensure_row(name_a)
        ui.ensure_row(name_b)
        row_text = ui.row(name_a).inner_text()
        assert "列表甲" in row_text, row_text
        assert "源码构建" in row_text, row_text

        # Server-side paging: the list request carries page/limit to the kapis proxy.
        list_requests = [
            entry for entry in requests if "/kapis/resources.kubesphere.io/v1alpha3/" in entry and "/s2ibuilders" in entry
        ]
        assert list_requests, "列表没有走 kapis 资源代理"
        assert any("page=" in entry and "limit=" in entry for entry in list_requests), list_requests

        # Search is a server-side name query; only the matching row remains.
        ui.search(name_b)
        assert ui.row_names() == [name_b], ui.row_names()

        # Clearing the search and refreshing keeps the search value and re-reads.
        ui.page.locator('[data-ai-id="image-builder:search"]').last.fill("")
        ui.page.wait_for_timeout(500)
        ui.wait_ready()
        ui.click("image-builder:refresh")
        ui.wait_ready()
        expect(surface).to_have_attribute("data-ai-state", "ready")
        screenshot(ui.page, "image-builder-list")
    finally:
        ui.delete_builder(name_a)
        ui.delete_builder(name_b)
