from __future__ import annotations

import re
from collections import Counter

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"
KAPIS = "/kapis/alerting.kubesphere.io/v2beta1"


def _groups(api) -> dict[str, dict]:
    status, body = api.request("GET", f"{API}/globalrulegroups?limit=-1")
    if status != 200 or not isinstance(body, dict):
        return {}
    return {group["metadata"]["name"]: group for group in body.get("items") or []}


def _alerts(api) -> tuple[list[dict], int]:
    status, body = api.request("GET", f"{KAPIS}/globalalerts?limit=100&sortBy=activeAt&ascending=false")
    if status != 200 or not isinstance(body, dict):
        return [], 0
    return body.get("items") or [], int(body.get("totalItems") or 0)


def _alert_times(text: str) -> list[str]:
    return re.findall(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", text)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_06(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-06 告警策略详情：告警消息时间线、空态与失败重试。"""

    ui = monitoring_page
    assert ui.api is not None

    groups = _groups(ui.api)
    if not groups:
        pytest.skip("集群不提供 globalrulegroups")

    items, _total = _alerts(ui.api)
    by_group = Counter(item.get("labels", {}).get("rule_group") for item in items)
    with_alerts = [name for name in groups if by_group.get(name, 0) > 0]
    without_alerts = [name for name in groups if by_group.get(name, 0) == 0]
    if not with_alerts or not without_alerts:
        pytest.skip("需要同时存在有告警和无告警的规则组才能核对两种状态")

    firing_group = max(with_alerts, key=lambda name: by_group[name])
    ui.open_detail(firing_group, scope="global")
    expect(ui.detail_surface()).to_be_visible(timeout=30_000)
    ui.wait_detail_ready()

    section = ui.messages_section()
    expect(section).to_be_visible(timeout=20_000)
    expect(section).to_have_attribute("data-ai-state", "ready", timeout=60_000)

    rows = ui.message_rows()
    expect(rows.first).to_be_visible(timeout=20_000)
    shown = rows.count()
    assert 0 < shown <= 10, f"消息行数 {shown} 不合理"

    # The page's own total and row count must agree: the list is server-paginated, so a
    # local re-filter would make these two disagree.
    total_text = ui.page.locator('[data-ai-id="alertingrules:detail:messages:total"]').inner_text()
    total = int(re.search(r"(\d+)", total_text).group(1))
    assert shown == min(total, 10), f"行数 {shown} 与总数 {total} 不一致"
    # Same-response reconciliation: the API's filtered total is the page's total.
    status, body = ui.api.request(
        "GET", f"{KAPIS}/globalalerts?limit=1&label_filters=rule_group={firing_group}"
    )
    assert status == 200, status
    assert total == int(body.get("totalItems") or 0), f"页面总数 {total} 与接口 {body.get('totalItems')} 不一致"

    # Newest first, as the old console sorted by activeAt descending.
    times = _alert_times(rows.first.inner_text())
    assert times, f"第一条消息没有触发时间: {rows.first.inner_text()[:200]}"
    all_times: list[str] = []
    for index in range(shown):
        all_times.extend(_alert_times(rows.nth(index).inner_text())[:1])
    assert all_times == sorted(all_times, reverse=True), f"消息没有按时间倒序: {all_times}"

    # A message carries the state label and, when the alert names an object, the target.
    first_text = rows.first.inner_text()
    assert any(state in first_text for state in ("告警中", "待触发")), first_text[:200]

    screenshot(ui.page, "alertingrules-detail-messages")

    # ---- a policy with no active alerts explains the empty state ----
    empty_group = without_alerts[0]
    ui.open_detail(empty_group, scope="global")
    empty = ui.messages_section()
    expect(empty).to_have_attribute("data-ai-state", "empty", timeout=60_000)
    empty_text = empty.inner_text()
    assert "该策略当前没有告警消息" in empty_text, empty_text[:200]
    assert "错误" not in empty_text

    screenshot(ui.page, "alertingrules-detail-messages-empty")

    # ---- a failing messages endpoint shows an error with a retry, and the retry recovers ----
    ui.page.route(
        "**/kapis/alerting.kubesphere.io/v2beta1/globalalerts**",
        lambda route: route.fulfill(status=500, content_type="application/json", body='{"message":"injected failure"}'),
    )
    try:
        ui.open_detail(firing_group, scope="global")
        failed = ui.messages_section()
        expect(failed).to_have_attribute("data-ai-state", "error", timeout=60_000)
        retry = ui.page.locator('[data-ai-id="alertingrules:detail:messages:retry"]')
        expect(retry).to_be_visible(timeout=20_000)
    finally:
        ui.page.unroute("**/kapis/alerting.kubesphere.io/v2beta1/globalalerts**")

    retry.click()
    expect(ui.messages_section()).to_have_attribute("data-ai-state", "ready", timeout=60_000)
