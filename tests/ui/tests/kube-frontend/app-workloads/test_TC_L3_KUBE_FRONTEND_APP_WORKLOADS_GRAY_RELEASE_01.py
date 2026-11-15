from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage, strategy_manifest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01 灰度发布列表：空态、六列与版本权重、名称下钻详情。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    suffix = uuid4().hex[:8]
    name = f"tc-e2e-gray-{suffix}"
    target = f"tc-e2e-gray-svc-{suffix}"

    try:
        existing = canary.list_strategies()

        # ---- empty state when the project has nothing yet ----
        canary.open_list()
        if not existing:
            assert canary.state == "empty", canary.state
            expect(canary.surface).to_contain_text("暂无灰度发布任务")

        # ---- one weighted canary, with a controller condition injected ----
        canary.create_strategy(strategy_manifest(name, target, canary.namespace, weights=(80, 20)))
        canary.set_conditions(
            name,
            [
                {
                    "type": "Complete",
                    "status": "True",
                    "reason": "Done",
                    "message": "all traffic shifted",
                    "lastTransitionTime": "2026-11-15T00:00:00Z",
                }
            ],
            completion_time="2026-11-15T00:00:00Z",
        )

        canary.open_list()
        expect(canary.surface).to_have_attribute("data-ai-state", "ready")

        headers = canary.headers()
        for column in ("名称", "类型", "目标服务", "版本", "状态", "创建时间"):
            assert column in headers, headers

        row = canary.row(name)
        expect(row).to_be_visible()
        text = row.inner_text()
        # spec.type drives the badge; the Chinese word proves the mapping ran.
        assert "金丝雀发布" in text, text
        # The target service is hosts[0], not the strategy name.
        assert target in text, text
        # Both versions and both weights come from the weighted routes.
        assert "v2" in text and "v1" in text, text
        assert "20%" in text and "80%" in text, text
        # Complete=True is derived to 已完成.
        assert "已完成" in text, text

        canary.open_detail(name)
        expect(canary.detail_surface).to_be_visible()
        screenshot(ui.page, "gray-release-list")
    finally:
        canary.cleanup(name)
