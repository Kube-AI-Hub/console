from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"
CONDITION_TYPES = ("PodScheduled", "Initialized", "ContainersReady", "Ready")


def _create_pod(ui, name: str) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": name}},
        "spec": {
            "terminationGracePeriodSeconds": 0,
            "containers": [{"name": "main", "image": UNPULLABLE}],
            "nodeSelector": UNSCHEDULABLE,
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建容器组 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _pod(ui, name: str) -> dict:
    status, body = ui._request("GET", f"/api/v1/namespaces/default/pods/{name}")
    assert status == 200 and isinstance(body, dict), f"读取容器组 {name} 失败：HTTP {status}"
    return body


def _conditions(item: dict) -> dict[str, dict]:
    return {str(c.get("type")): c for c in (item.get("status") or {}).get("conditions") or []}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_TABS_04(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-04 容器组详情：状态信息与四项条件。"""

    ui = app_workloads_page
    assert ui.api is not None

    name = _create_pod(ui, ui.unique("conds"))
    try:
        ui.open_detail("pods", name)
        surface = ui.detail_surface("pods")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        ui.page.locator('[data-ai-id="workload-detail:tab-trigger:schedule"]').click()
        expect(ui.page.locator('[data-ai-id="workload-detail:tab:schedule"]')).to_be_visible(timeout=20_000)

        block = ui.page.locator('[data-ai-id="pods-detail:schedule-status"]')
        expect(block).to_be_visible(timeout=20_000)

        item = _pod(ui, name)
        conditions = _conditions(item)
        assert conditions, f"容器组 {name} 没有 status.conditions，无法核对条件行"

        # ---- the current status is shown, and it is not a hard-coded word ----
        current = ui.page.locator('[data-ai-id="pods-detail:current-status"]').inner_text().strip()
        assert current, "当前状态为空"

        # ---- exactly the four kubectl conditions that the object actually carries ----
        rendered = {
            ai_id.rsplit(":", 1)[-1]
            for ai_id in block.locator('[data-ai-id^="pods-detail:condition:"]').evaluate_all(
                "els => els.map(e => e.getAttribute('data-ai-id'))"
            )
        }
        expected = {t for t in CONDITION_TYPES if t in conditions}
        assert rendered == expected, f"条件行应为对象里存在的 {sorted(expected)}，实际 {sorted(rendered)}"

        # ---- each row's met/unmet badge and its detail follow the object ----
        for condition_type in expected:
            row = ui.page.locator(f'[data-ai-id="pods-detail:condition:{condition_type}"]')
            expect(row).to_be_visible()
            condition = conditions[condition_type]
            met = condition.get("status") == "True"
            text = row.inner_text()
            assert ("已满足" if met else "未满足") in text, f"{condition_type} 的满足状态不对：{text!r}"
            if condition.get("reason"):
                assert str(condition["reason"]) in text, f"{condition_type} 应显示原因：{text!r}"
            if condition.get("message"):
                assert str(condition["message"]) in text, f"{condition_type} 应显示消息：{text!r}"

        # A pod that cannot be scheduled is exactly where this block earns its keep.
        scheduled = conditions.get("PodScheduled")
        if scheduled is not None:
            assert scheduled.get("status") == "False", f"未调度的容器组 PodScheduled 应为 False：{scheduled}"
            assert "Unschedulable" in ui.page.locator('[data-ai-id="pods-detail:condition:PodScheduled"]').inner_text()

        screenshot(ui.page, "pods-detail-schedule-conditions")
    finally:
        ui.delete_pod(name, timeout=120)
