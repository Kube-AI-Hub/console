from __future__ import annotations

import time
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage, strategy_manifest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_05(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-05 调整流量：权重/接管/蓝绿写回与回读一致、非法输入不写、镜像无入口。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    suffix = uuid4().hex[:8]
    names = {
        "traffic": f"tc-e2e-gray-traffic-{suffix}",
        "content": f"tc-e2e-gray-content-{suffix}",
        "bluegreen": f"tc-e2e-gray-bg-{suffix}",
        "mirror": f"tc-e2e-gray-mirror-{suffix}",
    }

    try:
        canary.create_strategy(strategy_manifest(names["traffic"], f"tc-e2e-gray-t-{suffix}", canary.namespace, weights=(80, 20)))
        canary.create_strategy(
            strategy_manifest(
                names["content"],
                f"tc-e2e-gray-c-{suffix}",
                canary.namespace,
                weights=None,
                match=[{"headers": {"cookie": {"regex": "user=canary"}}}],
            )
        )
        canary.create_strategy(
            strategy_manifest(names["bluegreen"], f"tc-e2e-gray-b-{suffix}", canary.namespace, type_="Bluegreen", weights=(100, 0), governor="v1")
        )
        canary.create_strategy(strategy_manifest(names["mirror"], f"tc-e2e-gray-m-{suffix}", canary.namespace, mirror=True))

        # ---- weighted canary: 35, then the two governor extremes ----
        canary.open_detail_url(names["traffic"])
        canary.open_traffic()
        canary.set_weight(35)
        expect(canary.traffic_summary).to_contain_text("35%")
        canary.traffic_submit.click()
        assert canary.wait_governor(names["traffic"], "") is True
        canary.wait_weights(names["traffic"], [65, 35])
        expect(canary.notice).to_be_visible(timeout=20_000)
        expect(canary.version_card("v2")).to_contain_text("35%")

        canary.open_traffic()
        canary.set_weight(100)
        canary.traffic_submit.click()
        assert canary.wait_governor(names["traffic"], "v2") is True
        canary.wait_weights(names["traffic"], [0, 100])

        canary.open_traffic()
        canary.set_weight(0)
        canary.traffic_submit.click()
        assert canary.wait_governor(names["traffic"], "v1") is True
        canary.wait_weights(names["traffic"], [100, 0])

        # ---- invalid input: blocked locally, nothing written ----
        canary.open_traffic()
        canary.set_weight(150)
        expect(canary.traffic_error).to_be_visible()
        expect(canary.traffic_submit).to_be_disabled()
        time.sleep(0.8)
        assert canary.governor_of(names["traffic"]) == "v1"
        assert canary.route_weights(names["traffic"]) == [100, 0]
        canary.traffic_cancel.click()

        # ---- content canary: takeover by the new version ----
        canary.open_detail_url(names["content"])
        canary.open_traffic()
        canary.traffic_mode("mode:new:v2").click()
        canary.traffic_submit.click()
        assert canary.wait_governor(names["content"], "v2") is True
        item = canary.get_strategy(names["content"])
        assert item is not None
        http = (((item.get("spec") or {}).get("template") or {}).get("spec") or {}).get("http") or []
        assert http[0].get("match"), "接管写入把匹配规则清掉了"

        # ---- blue-green: the chosen version receives everything ----
        canary.open_detail_url(names["bluegreen"])
        canary.open_traffic()
        canary.traffic_version("v2").click()
        canary.traffic_submit.click()
        assert canary.wait_governor(names["bluegreen"], "v2") is True
        canary.wait_weights(names["bluegreen"], [0, 100])

        # ---- mirror: no traffic control at all ----
        canary.open_detail_url(names["mirror"])
        expect(canary.detail_surface).to_be_visible()
        expect(canary.edit_traffic_button).to_have_count(0)
        screenshot(ui.page, "gray-release-traffic")
    finally:
        canary.cleanup(*names.values())
