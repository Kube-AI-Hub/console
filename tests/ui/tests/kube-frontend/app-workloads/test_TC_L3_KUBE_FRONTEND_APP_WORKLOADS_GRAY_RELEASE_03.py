from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage, strategy_manifest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-03 详情：四区块顺序、版本权重与副本数、未找到工作负载分支、三档宽度。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    suffix = uuid4().hex[:8]
    name = f"tc-e2e-gray-{suffix}"
    target = f"tc-e2e-gray-detail-{suffix}"
    workload_v2 = target + "-v2"

    try:
        canary.create_deployment(workload_v2, {"app": target}, replicas=1)
        canary.create_strategy(strategy_manifest(name, target, canary.namespace, weights=(80, 20)))

        canary.open_detail_url(name)
        expect(canary.detail_surface).to_have_attribute("data-ai-state", "ready")

        # ---- attributes ----
        assert canary.definition("集群") == "host"
        assert canary.definition("项目") == canary.namespace
        assert canary.definition("分流方式") == "按流量比例"
        assert canary.definition("目标服务") == target
        assert canary.definition("参考版本") == "v1"
        assert canary.definition("接管版本") == "未接管（按规则分配）"
        assert canary.definition("策略") == "WaitForWorkloadReady"
        assert canary.definition("创建时间") != "-"

        # ---- versions: weights, roles, replicas and the workload link ----
        v2 = canary.version_card("v2")
        v2_text = v2.inner_text()
        assert "新版本" in v2_text, v2_text
        assert "20%" in v2_text, v2_text
        assert "副本 0/1" in v2_text, v2_text
        link = canary.workload_link(workload_v2)
        expect(link).to_be_visible()
        assert link.get_attribute("href").endswith("/deployments/" + workload_v2), link.get_attribute("href")

        v1_text = canary.version_card("v1").inner_text()
        assert "参考版本" in v1_text, v1_text
        assert "80%" in v1_text, v1_text
        assert "未找到对应工作负载" in v1_text, v1_text
        assert "0/0" not in v1_text, v1_text

        # ---- match rules / conditions empties are explained, not blank ----
        expect(canary.match_rules_empty).to_be_visible()
        assert "按权重分流" in canary.match_rules_empty.inner_text()
        expect(canary.conditions_empty).to_be_visible()
        assert "控制器尚未写入条件" in canary.conditions_empty.inner_text()

        # ---- fixed section order ----
        tops = canary.section_tops()
        assert tops == sorted(tops), tops

        # ---- no horizontal overflow at the three reviewed widths ----
        for width in (1024, 1280, 1600):
            ui.page.set_viewport_size({"width": width, "height": 900})
            ui.page.wait_for_timeout(180)
            overflow = ui.page.evaluate("() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth })")
            assert overflow["scroll"] <= overflow["inner"] + 1, (width, overflow)
            screenshot(ui.page, f"gray-release-detail-{width}")
        ui.page.set_viewport_size({"width": 1600, "height": 900})
    finally:
        canary.cleanup(name)
        canary.delete_deployment(workload_v2)
