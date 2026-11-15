from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

LIST_GLOB = "**/kapis/resources.kubesphere.io/v1alpha3/namespaces/*/s2ibuilders*"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_12(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12 状态与视觉：空/失败/无权限/英文五态分开（响应为拦截模拟）。"""

    ui = image_builder_page
    page = ui.page

    # Empty: a 200 with no rows is a real empty state, not an error.
    def fulfill_empty(route):
        route.fulfill(json={"items": [], "totalItems": 0})

    page.route(LIST_GLOB, fulfill_empty)
    try:
        ui.page.goto(ui.list_url())
        expect(ui.surface()).to_be_visible(timeout=20_000)
        ui.wait_ready()
        expect(ui.surface()).to_have_attribute("data-ai-state", "empty")
        body = ui.surface().inner_text()
        assert "暂无镜像构建器" in body, body
        assert page.locator('[data-ai-id="resource-error"]').count() == 0
        screenshot(page, "image-builder-empty")
    finally:
        page.unroute(LIST_GLOB, fulfill_empty)

    # Failure: a 500 is an error with a retry, never an empty state.
    def fulfill_error(route):
        route.fulfill(status=500, json={"code": "internal_error", "message": "boom", "status": 500})

    page.route(LIST_GLOB, fulfill_error)
    try:
        ui.open_list()
        expect(page.locator('[data-ai-id="resource-error"]')).to_be_visible()
        expect(ui.surface()).to_have_attribute("data-ai-state", "error")
        expect(page.locator('[data-ai-id="image-builder:retry"]')).to_be_visible()
    finally:
        page.unroute(LIST_GLOB, fulfill_error)

    # Permission: show the reason, offer no retry (pressing it can only fail again).
    def fulfill_forbidden(route):
        route.fulfill(status=403, json={"code": "forbidden", "message": "forbidden", "status": 403})

    page.route(LIST_GLOB, fulfill_forbidden)
    try:
        ui.open_list()
        expect(page.locator('[data-ai-id="resource-error"]')).to_be_visible()
        assert "没有权限" in page.locator('[data-ai-id="resource-error"]').inner_text()
        assert page.locator('[data-ai-id="image-builder:retry"]').count() == 0
        assert ui.state() == "error"
    finally:
        page.unroute(LIST_GLOB, fulfill_forbidden)

    # English: the same surface in the other language, with no raw locale keys.
    # A table header only exists when the project has a row, so the case owns one builder;
    # relying on leftover data made this pass or fail depending on the previous case.
    name = ui.unique("en")
    try:
        assert ui.create_builder(name, display_name="English label") == 201
        page.set_viewport_size({"width": 1600, "height": 900})
        page.add_init_script("try { localStorage.setItem('kube-frontend-locale', 'en') } catch (e) {}")
        ui.open_list()
        expect(ui.surface()).to_be_visible()
        ui.wait_ready()
        headers = ui.headers()
        assert "Name" in headers, headers
        assert "Status" in headers, headers
        assert "Created" in headers, headers
        assert "devopsProject.s2ibuilder" not in ui.surface().inner_text()
        screenshot(page, "image-builder-en")
    finally:
        ui.delete_builder(name)
