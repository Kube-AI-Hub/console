from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: The page reads the kapis proxy, not /api/v1: the two paths can lag each other by a
#: moment after a write, so the case waits on the same source the table renders from.
PODS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/pods"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"
def _waiting_reason(item: dict) -> str:
    """The first container-level reason the object reports (what the row should print)."""
    status = item.get("status") or {}
    for container in (status.get("initContainerStatuses") or []) + (status.get("containerStatuses") or []):
        state = (container or {}).get("state") or {}
        for kind in ("waiting", "terminated"):
            reason = str((state.get(kind) or {}).get("reason") or "")
            if reason:
                return reason
    return ""


def _has_reason(item: dict) -> bool:
    """Does the object carry any container-level reason at all?

    Deliberately not a copy of the page's derivation: the case must be able to disagree
    with it. It only answers "is there anything to print", which is what the AC needs.
    """
    return bool(_waiting_reason(item))


def _pods(ui) -> list[dict]:
    status, body = ui._request("GET", f"{PODS}?limit=-1")
    assert status == 200 and isinstance(body, dict), f"读取容器组失败：HTTP {status} — {repr(body)[:200]}"
    return list(body.get("items") or [])


def _create_pod(ui, name: str, image: str, node_selector: dict | None) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": name}},
        "spec": {
            "terminationGracePeriodSeconds": 0,
            "containers": [{"name": "main", "image": image}],
            **({"nodeSelector": node_selector} if node_selector else {}),
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建容器组 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _wait_reason(ui, name: str, timeout: float = 90) -> str:
    """Wait until the pod's container reports a reason (ContainerCreating …)."""
    deadline = time.time() + timeout
    seen = ""
    while time.time() < deadline:
        for item in _pods(ui):
            if (item.get("metadata") or {}).get("name") == name:
                seen = _waiting_reason(item)
                if seen:
                    return seen
        time.sleep(1.0)
    raise AssertionError(f"容器组 {name} 的容器一直没有等待原因（最后看到 {seen!r}）")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_07(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-07 容器组列表：状态徽标之后显示原因。"""

    ui = app_workloads_page
    assert ui.api is not None

    # A scheduled pod whose image can never be pulled: the container stays in
    # ErrImagePull / ImagePullBackOff, so the reason is stable (an nginx pod would start
    # and lose its reason mid-case).
    reasoned = _create_pod(ui, ui.unique("reason"), UNPULLABLE, None)
    # A pod that cannot be scheduled at all: its reason is just the phase.
    plain = _create_pod(ui, ui.unique("plain"), UNPULLABLE, UNSCHEDULABLE)
    try:
        expected_reason = _wait_reason(ui, reasoned)

        ui.open("pods")
        surface = ui.surface("pods")
        expect(surface).to_be_visible(timeout=30_000)
        ui.wait_ready(surface)

        # ---- the waiting container's reason is rendered after the badge ----
        # The row's reason is derived from the list response. A list fetched in the same
        # second the container entered ContainerCreating can miss it, and the list does not
        # poll — so re-read (what a person does) instead of failing on that race.
        reason = ui.row("pods", reasoned).locator(f'[data-ai-id="pods:reason:{reasoned}"]')
        for _attempt in range(3):
            ui.ensure_row("pods", reasoned)
            if reason.count() > 0:
                break
            ui.page.reload()
            ui.wait_ready(ui.surface("pods"))
            ui.page.wait_for_timeout(2_000)
        expect(reason).to_be_visible(timeout=20_000)
        row = ui.row("pods", reasoned)
        # The pull failure's reason *moves* (ContainerCreating → ErrImagePull →
        # ImagePullBackOff) while the case runs, and the list does not poll. Re-read the
        # server's current reason instead of comparing with the snapshot taken before the
        # page opened; the pull-failure family is accepted as one value.
        current = _wait_reason(ui, reasoned)
        shown = reason.inner_text().strip()
        pull_reasons = {"ContainerCreating", "ErrImagePull", "ImagePullBackOff"}
        assert shown == current or (shown in pull_reasons and current in pull_reasons), (
            f"状态原因应为 {current!r}：{shown!r}"
        )
        # Same cell as the badge, and below it: the AC says "after the badge", which is
        # an order relation, not a class name.
        cell = reason.evaluate("el => (el.closest('td') || {}).innerText || ''")
        assert "等待中" in cell, f"原因应与状态徽标同列：{cell!r}"
        badge_box = row.get_by_text("等待中", exact=True).first.bounding_box()
        reason_box = reason.bounding_box()
        assert badge_box and reason_box, "读不到徽标或原因的盒子"
        tolerance = max(2.0, (badge_box["height"] or 1) * 0.5)
        assert reason_box["y"] >= badge_box["y"] - tolerance, (
            f"原因应显示在徽标之后（下方）：badge={badge_box} reason={reason_box}"
        )

        # ---- a row whose reason only repeats the phase shows the badge alone ----
        ui.ensure_row("pods", plain)
        assert ui.row("pods", plain).locator(f'[data-ai-id="pods:reason:{plain}"]').count() == 0, (
            "没有额外原因的容器组不该显示原因"
        )

        # ---- no row gets a reason the object cannot back up ----
        page_rows = set(ui.row_names("pods"))
        with_reason = {str((item.get("metadata") or {}).get("name")) for item in _pods(ui) if _has_reason(item)}
        rendered = {
            ai_id.rsplit(":", 1)[-1]
            for ai_id in surface.locator('[data-ai-id^="pods:reason:"]').evaluate_all(
                "els => els.map(e => e.getAttribute('data-ai-id'))"
            )
        }
        assert rendered <= page_rows, f"原因元素出现在不存在的行上：{sorted(rendered - page_rows)}"
        assert rendered <= with_reason, (
            f"这些行显示的原因在对象里找不到依据：{sorted(rendered - with_reason)}"
        )

        screenshot(ui.page, "pods-list-status-reason")
    finally:
        ui.delete_pod(reasoned, timeout=120)
        ui.delete_pod(plain, timeout=120)
