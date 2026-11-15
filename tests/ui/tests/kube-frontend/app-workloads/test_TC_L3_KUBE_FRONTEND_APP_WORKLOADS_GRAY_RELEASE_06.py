from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage, strategy_manifest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_06(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06 暂停/恢复：governor 接管并保留权重，恢复还原原比例。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    suffix = uuid4().hex[:8]
    traffic_name = f"tc-e2e-gray-pause-{suffix}"
    content_name = f"tc-e2e-gray-pause-content-{suffix}"

    try:
        canary.create_strategy(strategy_manifest(traffic_name, f"tc-e2e-gray-p-{suffix}", canary.namespace, weights=(65, 35)))
        canary.create_strategy(
            strategy_manifest(
                content_name,
                f"tc-e2e-gray-pc-{suffix}",
                canary.namespace,
                weights=None,
                match=[{"uri": {"prefix": "/beta"}}],
            )
        )

        # ---- weighted canary: pause and resume ----
        canary.open_detail_url(traffic_name)
        canary.pause_button.click()
        assert canary.wait_governor(traffic_name, "v1") is True
        assert canary.route_weights(traffic_name) == [65, 35], "暂停改了权重"
        expect(canary.resume_button).to_be_visible(timeout=20_000)
        expect(canary.notice).to_contain_text("已暂停")

        canary.resume_button.click()
        assert canary.wait_governor(traffic_name, "") is True
        assert canary.route_weights(traffic_name) == [65, 35], "恢复没有保留权重"
        expect(canary.pause_button).to_be_visible(timeout=20_000)
        expect(canary.notice).to_contain_text("已恢复")

        # ---- content canary: same lever, match rules untouched ----
        canary.open_detail_url(content_name)
        canary.pause_button.click()
        assert canary.wait_governor(content_name, "v1") is True
        item = canary.get_strategy(content_name)
        assert item is not None
        http = (((item.get("spec") or {}).get("template") or {}).get("spec") or {}).get("http") or []
        assert http[0].get("match"), "暂停把匹配规则清掉了"

        canary.resume_button.click()
        assert canary.wait_governor(content_name, "") is True
        screenshot(ui.page, "gray-release-pause")
    finally:
        canary.cleanup(traffic_name, content_name)
