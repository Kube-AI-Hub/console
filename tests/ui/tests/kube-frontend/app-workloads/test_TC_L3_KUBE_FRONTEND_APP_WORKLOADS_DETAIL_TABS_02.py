from __future__ import annotations

from datetime import datetime

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SYSTEM_NAMESPACE = "kubesphere-system"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
TAB_KEYS = ("overview", "schedule", "monitor", "containers", "env", "events", "metadata")
TAB_LABELS = ("概览", "调度信息", "监控", "容器", "环境变量", "事件", "元数据")


def _pods(ui, namespace: str) -> list[dict]:
    status, body = ui._request("GET", f"/api/v1/namespaces/{namespace}/pods?limit=200")
    assert status == 200 and isinstance(body, dict), f"读取 {namespace} 容器组失败：HTTP {status} — {repr(body)[:200]}"
    return list(body.get("items") or [])


def _scheduled_pod(ui) -> tuple[str, dict]:
    """A pod that is on a node and has the PodScheduled condition, default first."""
    for namespace in ("default", SYSTEM_NAMESPACE):
        for item in _pods(ui, namespace):
            spec = item.get("spec") or {}
            conditions = (item.get("status") or {}).get("conditions") or []
            scheduled = [c for c in conditions if c.get("type") == "PodScheduled"]
            if spec.get("nodeName") and scheduled and scheduled[0].get("status") == "True":
                return namespace, item
    raise AssertionError("集群里没有已调度且带 PodScheduled 条件的容器组，无法核对调度结果")


def _local(ts: str) -> str:
    """The page prints `YYYY-MM-DD HH:mm:ss` in the browser's own time zone."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def _open(ui, namespace: str, name: str):
    if namespace == "default":
        ui.open_detail("pods", name)
    else:
        origin = ui.base.split("/kube-frontend/")[0]
        ui.page.goto(f"{origin}/kube-frontend/{ui.workspace}/clusters/{ui.cluster}/projects/{namespace}/pods/{name}")
    surface = ui.detail_surface("pods")
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    return surface


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_TABS_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-02 容器组详情：页签集合与调度结果。"""

    ui = app_workloads_page
    assert ui.api is not None

    namespace, scheduled_item = _scheduled_pod(ui)
    scheduled_name = str(scheduled_item["metadata"]["name"])
    node = str((scheduled_item.get("spec") or {}).get("nodeName"))
    condition = next(c for c in scheduled_item["status"]["conditions"] if c.get("type") == "PodScheduled")
    expected_at = _local(str(condition.get("lastTransitionTime")))

    pending = ui.unique("sched-pending")
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": pending, "namespace": "default", "labels": {"app": pending}},
        "spec": {
            "terminationGracePeriodSeconds": 0,
            "containers": [{"name": "main", "image": "tc-e2e.invalid/never-pulled:1.0"}],
            "nodeSelector": UNSCHEDULABLE,
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建未调度容器组失败：{status} {repr(payload)[:200]}"
    try:
        # ---- the pod detail carries seven tabs, in this order, overview selected ----
        _open(ui, namespace, scheduled_name)
        detail_requests: list[str] = []
        ui.page.on(
            "request",
            lambda request: detail_requests.append(request.url)
            if request.method == "GET" and request.url.split("?")[0].endswith(f"/pods/{scheduled_name}")
            else None,
        )
        triggers = [ui.page.locator(f'[data-ai-id="workload-detail:tab-trigger:{key}"]') for key in TAB_KEYS]
        for trigger in triggers:
            expect(trigger).to_be_visible(timeout=20_000)
        labels = [trigger.inner_text().strip() for trigger in triggers]
        assert labels == list(TAB_LABELS), f"页签应为 {TAB_LABELS}，实际 {labels}"
        expect(triggers[0]).to_have_attribute("aria-selected", "true")

        # ---- 调度信息: scheduled branch reads node + PodScheduled time from the object ----
        triggers[1].click()
        expect(ui.page.locator('[data-ai-id="workload-detail:tab:schedule"]')).to_be_visible(timeout=20_000)
        result = ui.page.locator('[data-ai-id="pods-detail:schedule-result"]')
        expect(result).to_be_visible(timeout=20_000)
        node_link = ui.page.locator('[data-ai-id="pods-detail:scheduled-node"]')
        expect(node_link).to_be_visible()
        assert f"已调度到节点 {node}" in node_link.inner_text(), f"调度结果应含节点名 {node}：{node_link.inner_text()!r}"
        at = ui.page.locator('[data-ai-id="pods-detail:scheduled-at"]').inner_text().strip()
        assert at == expected_at, f"调度时间应为 PodScheduled 条件的 {expected_at!r}，实际 {at!r}"
        assert detail_requests == [], f"切到调度信息不该重新请求容器组详情：{detail_requests}"

        screenshot(ui.page, "pods-detail-schedule-scheduled")

        # ---- 调度信息: unscheduled branch ----
        _open(ui, "default", pending)
        ui.page.locator('[data-ai-id="workload-detail:tab-trigger:schedule"]').click()
        expect(ui.page.locator('[data-ai-id="workload-detail:tab:schedule"]')).to_be_visible(timeout=20_000)
        pending_result = ui.page.locator('[data-ai-id="pods-detail:schedule-result"]')
        expect(pending_result).to_be_visible(timeout=20_000)
        assert "调度未成功" in pending_result.inner_text(), pending_result.inner_text()
        # A Pending pod usually *has* the PodScheduled condition (status=False, reason
        # Unschedulable), so its time is the moment scheduling failed — informative, and
        # what the object says. Only a pod without that condition shows "-".
        pending_item = ui._request("GET", f"/api/v1/namespaces/default/pods/{pending}")[1]
        pending_conditions = {
            str(c.get("type")): c for c in (pending_item.get("status") or {}).get("conditions") or []
        }
        pending_at = ui.page.locator('[data-ai-id="pods-detail:scheduled-at"]').inner_text().strip()
        if "PodScheduled" in pending_conditions:
            assert pending_at == _local(str(pending_conditions["PodScheduled"].get("lastTransitionTime"))), (
                f"未调度时调度时间应取 PodScheduled 条件的时间：{pending_at!r}"
            )
        else:
            assert pending_at == "-", f"没有 PodScheduled 条件时应显示 -：{pending_at!r}"
        screenshot(ui.page, "pods-detail-schedule-unscheduled")
    finally:
        ui.delete_pod(pending, timeout=120)
