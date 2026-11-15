from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage

pytestmark = pytest.mark.ui


def _content_match() -> list[dict]:
    """One match entry per request fact, plus a match kind the page does not model."""
    return [
        {"headers": {"cookie": {"regex": "user=canary"}}},
        {"uri": {"prefix": "/v2"}},
        {"headers": {"x-tenant": {"exact": "acme"}}},
        {"method": {"exact": "GET"}},
    ]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_04(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-04 匹配规则表与状态条件：Complete/Failed 派生与空条件说明。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    suffix = uuid4().hex[:8]
    content_name = f"tc-e2e-gray-content-{suffix}"
    plain_name = f"tc-e2e-gray-plain-{suffix}"
    content_target = f"tc-e2e-gray-content-svc-{suffix}"
    plain_target = f"tc-e2e-gray-plain-svc-{suffix}"

    try:
        canary.create_strategy(
            {
                "apiVersion": "servicemesh.kubesphere.io/v1alpha2",
                "kind": "Strategy",
                "metadata": {"name": content_name, "namespace": canary.namespace, "labels": {"app": content_target}},
                "spec": {
                    "type": "Canary",
                    "principal": "v1",
                    "governor": "",
                    "strategyPolicy": "WaitForWorkloadReady",
                    "selector": {"matchLabels": {"app": content_target}},
                    "template": {
                        "spec": {
                            "hosts": [content_target],
                            "http": [
                                {
                                    "match": _content_match(),
                                    "route": [{"destination": {"host": content_target, "subset": "v2"}, "weight": 100}],
                                },
                                {"route": [{"destination": {"host": content_target, "subset": "v1"}, "weight": 100}]},
                            ],
                        }
                    },
                },
            }
        )
        canary.create_strategy(
            {
                "apiVersion": "servicemesh.kubesphere.io/v1alpha2",
                "kind": "Strategy",
                "metadata": {"name": plain_name, "namespace": canary.namespace, "labels": {"app": plain_target}},
                "spec": {
                    "type": "Canary",
                    "principal": "v1",
                    "governor": "",
                    "selector": {"matchLabels": {"app": plain_target}},
                    "template": {
                        "spec": {
                            "hosts": [plain_target],
                            "http": [
                                {
                                    "route": [
                                        {"destination": {"host": plain_target, "subset": "v1"}, "weight": 100},
                                        {"destination": {"host": plain_target, "subset": "v2"}, "weight": 0},
                                    ]
                                }
                            ],
                        }
                    },
                },
            }
        )

        # ---- match rules: every entry becomes a row, including the unmodelled method ----
        canary.open_detail_url(content_name)
        rows = canary.match_rule_rows()
        expect(rows).to_have_count(4)
        table = canary.match_rules_section.inner_text()
        assert "Cookie" in table, table
        assert "URL" in table, table
        assert "请求头" in table, table
        assert "其他" in table, table
        assert "正则匹配" in table and "前缀匹配" in table and "精确匹配" in table, table
        assert "v2" in table, table

        # ---- conditions: Complete then Failed are derived, not guessed ----
        canary.set_conditions(
            content_name,
            [
                {
                    "type": "Complete",
                    "status": "True",
                    "reason": "Deployed",
                    "message": "all traffic shifted",
                    "lastTransitionTime": "2026-11-15T00:00:00Z",
                }
            ],
            completion_time="2026-11-15T00:00:00Z",
        )
        canary.open_detail_url(content_name)
        condition_text = canary.conditions_section.inner_text()
        for expected in ("Complete", "True", "Deployed", "all traffic shifted"):
            assert expected in condition_text, condition_text
        expect(canary.detail_surface).to_contain_text("已完成")

        canary.set_conditions(
            content_name,
            [
                {
                    "type": "Failed",
                    "status": "True",
                    "reason": "NoSuitableWorkload",
                    "message": "the workload does not exist",
                    "lastTransitionTime": "2026-11-15T00:00:00Z",
                }
            ],
        )
        canary.open_detail_url(content_name)
        failed_text = canary.conditions_section.inner_text()
        for expected in ("Failed", "NoSuitableWorkload", "the workload does not exist"):
            assert expected in failed_text, failed_text
        expect(canary.detail_surface).to_contain_text("失败")

        # ---- no condition: explained as unknown, not as failure ----
        canary.open_detail_url(plain_name)
        expect(canary.conditions_empty).to_be_visible()
        empty_text = canary.conditions_empty.inner_text()
        assert "控制器尚未写入条件" in empty_text, empty_text
        assert "未知" in canary.detail_surface.inner_text()
        screenshot(ui.page, "gray-release-conditions")
    finally:
        canary.cleanup(content_name, plain_name)
