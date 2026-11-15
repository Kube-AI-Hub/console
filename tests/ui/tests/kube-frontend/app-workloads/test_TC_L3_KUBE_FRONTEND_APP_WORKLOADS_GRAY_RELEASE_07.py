from __future__ import annotations

import json
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage, strategy_manifest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_07(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-07 删除：名称确认、取消不写、失败不关闭、成功后回读 404 并回到列表。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    suffix = uuid4().hex[:8]
    name = f"tc-e2e-gray-delete-{suffix}"
    target = f"tc-e2e-gray-delete-svc-{suffix}"

    def fail_delete(route, request):
        if request.method == "DELETE":
            route.fulfill(
                status=500,
                content_type="application/json",
                body=json.dumps({"message": "simulated upstream failure"}),
            )
            return
        route.fallback()

    try:
        canary.create_strategy(strategy_manifest(name, target, canary.namespace, weights=(100, 0)))

        # ---- typed-name friction, then cancel ----
        canary.open_detail_url(name)
        canary.open_delete()
        canary.delete_input.fill("not-the-name")
        expect(canary.delete_confirm).to_be_disabled()
        canary.page.get_by_role("dialog").get_by_role("button", name="取消").click()
        expect(canary.delete_input).to_have_count(0, timeout=15_000)
        assert canary.get_strategy(name) is not None, "取消删除却删掉了对象"

        # ---- server failure keeps the confirmation open and shows why ----
        ui.page.route("**/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/*/strategies/*", fail_delete)
        canary.open_delete()
        canary.delete_input.fill(name)
        expect(canary.delete_confirm).to_be_enabled()
        canary.delete_confirm.click()
        expect(canary.delete_input).to_be_visible(timeout=20_000)
        expect(canary.page.get_by_role("alert")).to_be_visible(timeout=20_000)
        assert canary.get_strategy(name) is not None

        # ---- without the failure the same confirmation deletes for real ----
        ui.page.unroute("**/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/*/strategies/*")
        canary.delete_confirm.click()
        assert canary.wait_strategy(name, present=False) is not None or canary.get_strategy(name) is None
        expect(canary.detail_surface).to_have_count(0, timeout=20_000)
        canary.page.wait_for_url("**/grayrelease")
        canary.wait_ready()
        expect(canary.row(name)).to_have_count(0, timeout=20_000)
        screenshot(ui.page, "gray-release-delete")
    finally:
        canary.cleanup(name)
