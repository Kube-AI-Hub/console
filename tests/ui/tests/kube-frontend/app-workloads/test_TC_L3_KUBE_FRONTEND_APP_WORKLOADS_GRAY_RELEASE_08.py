from __future__ import annotations

import json
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage, strategy_manifest

pytestmark = pytest.mark.ui

SSAR_GLOB = "**/selfsubjectaccessreviews"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_08(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08 权限门控：SSAR 允许/拒绝与 fail-open。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    suffix = uuid4().hex[:8]
    name = f"tc-e2e-gray-perm-{suffix}"
    target = f"tc-e2e-gray-perm-svc-{suffix}"
    checks: list[str] = []

    def deny(route, request):
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "apiVersion": "authorization.k8s.io/v1",
                    "kind": "SelfSubjectAccessReview",
                    "status": {"allowed": False, "reason": "denied by test"},
                }
            ),
        )

    ui.page.on(
        "request",
        lambda request: checks.append(request.post_data or "") if "selfsubjectaccessreviews" in request.url else None,
    )

    try:
        canary.create_strategy(strategy_manifest(name, target, canary.namespace, weights=(100, 0)))

        # ---- allowed: the real admin identity sees both write entries ----
        canary.open_list()
        expect(canary.create_button).to_be_enabled(timeout=20_000)
        assert checks, "页面没有发出 SelfSubjectAccessReview"
        assert any('"create"' in body for body in checks), checks

        canary.open_detail_url(name)
        expect(canary.delete_button).to_be_visible(timeout=20_000)
        # The delete check belongs to the detail; it must carry verb=delete.
        assert any('"delete"' in body for body in checks), checks

        # ---- denied: create disabled with a reason, delete not rendered ----
        ui.page.route(SSAR_GLOB, deny)
        canary.open_list()
        canary.wait_ready()
        expect(canary.create_button).to_be_disabled(timeout=20_000)
        expect(canary.surface).to_contain_text("没有创建灰度发布的权限")

        canary.open_detail_url(name)
        expect(canary.delete_button).to_have_count(0, timeout=20_000)

        # ---- fail-open after the check is available again ----
        ui.page.unroute(SSAR_GLOB)
        canary.open_list()
        expect(canary.create_button).to_be_enabled(timeout=20_000)
        canary.open_detail_url(name)
        expect(canary.delete_button).to_be_visible(timeout=20_000)
        screenshot(ui.page, "gray-release-permission")
    finally:
        canary.cleanup(name)
