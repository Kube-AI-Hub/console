from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"
KAPIS = "/kapis/alerting.kubesphere.io/v2beta1"


def _items(api, path: str) -> list[dict]:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status} {body}"
    return body.get("items") or []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_ALERTING_WRITE_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-01 集群告警：内置策略启停入口与消息下钻。"""

    ui = cluster_management_page
    assert ui.api is not None

    builtin = _items(ui.api, f"{API}/globalrulegroups")
    if not builtin:
        pytest.skip("集群没有内置告警策略，无法核对启停入口")

    # ---- builtin policies: switch entry follows the probe, edit/delete do not ----
    ui.page.goto(ui.url("alerting-policies"))
    surface = ui.page.locator('[data-ai-id="cluster-alerting-policies:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    ui.page.locator('[data-ai-id="cluster-alerting-policies:tab:builtin"]').click()
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(ui.page.locator('[data-ai-id="cluster-alerting-policies:builtin-hint"]')).to_be_visible(timeout=20_000)

    rows = surface.locator("[data-ai-row]")
    expect(rows.first).to_be_visible(timeout=30_000)
    rows.first.locator('button[aria-haspopup="menu"]').click()
    expect(ui.page.get_by_role("menuitem", name="详情", exact=True)).to_be_visible(timeout=20_000)
    # The probe says the enable label is writable, so exactly one of the two switch
    # entries must exist; edit/delete stay installer-only.
    switch_entries = ui.page.get_by_role("menuitem", name="启用", exact=True).count() + ui.page.get_by_role(
        "menuitem", name="停用", exact=True
    ).count()
    assert switch_entries == 1, f"内置策略应恰有一个启停入口，实际 {switch_entries}"
    assert ui.page.get_by_role("menuitem", name="编辑", exact=True).count() == 0
    assert ui.page.get_by_role("menuitem", name="删除", exact=True).count() == 0
    ui.page.keyboard.press("Escape")

    screenshot(ui.page, "cluster-alerting-policies-builtin")

    # ---- messages: clicking the first row's title opens the drill-down ----
    status, body = ui.api.request("GET", f"{KAPIS}/globalalerts?limit=1")
    if status != 200 or not isinstance(body, dict) or not (body.get("items") or []):
        pytest.skip("集群没有内置策略告警消息，无法核对下钻")

    ui.page.goto(ui.url("alerting-messages"))
    messages = ui.page.locator('[data-ai-id="cluster-alerting-messages:surface"]').last
    expect(messages).to_be_visible(timeout=30_000)
    expect(messages).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    first_row = messages.locator("[data-ai-row]").first
    expect(first_row).to_be_visible(timeout=30_000)
    first_row.locator('[data-ai-id="cluster-alerting-messages:open"]').click()

    detail = ui.page.locator('[data-ai-id="cluster-alerting-messages:detail"]')
    expect(detail).to_be_visible(timeout=20_000)
    text = detail.inner_text()
    # Fixed fields the drill-down promises.
    for label in ("摘要", "消息", "状态", "级别", "告警策略", "规则类型", "当前值"):
        assert label in text, f"详情缺少 {label}: {text[:300]}"

    labels = ui.page.locator('[data-ai-id="cluster-alerting-messages:detail:labels"]')
    annotations = ui.page.locator('[data-ai-id="cluster-alerting-messages:detail:annotations"]')
    expect(labels).to_be_visible(timeout=20_000)
    expect(annotations).to_be_visible(timeout=20_000)
    assert "alertname" in labels.inner_text(), labels.inner_text()
    assert ("summary" in annotations.inner_text()) or ("message" in annotations.inner_text()), annotations.inner_text()

    # The raw controller fields are not part of the allowlist; leaking the object
    # would surface rule_id/apiVersion-style keys instead of the summary.
    assert "rule_id" not in text, "详情泄露了未在白名单中的原始字段 rule_id"
    assert "apiVersion" not in text, "详情渲染了原始对象"

    screenshot(ui.page, "cluster-alerting-message-detail")
