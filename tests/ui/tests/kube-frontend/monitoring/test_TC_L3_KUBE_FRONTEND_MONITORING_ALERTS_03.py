from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MESSAGES = "/kube-frontend/clusters/host/alerting-messages"
GLOBAL_ALERTS = "/kapis/alerting.kubesphere.io/v2beta1/globalalerts?limit=20"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_ALERTS_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-03 告警消息：详情下钻（策略与监控对象）。"""

    ui = cluster_management_page
    assert ui.api is not None
    status, body = ui.api.request("GET", GLOBAL_ALERTS)
    items = (body or {}).get("items") or [] if status == 200 else []
    if not items:
        pytest.skip("集群没有聚合告警消息，下钻入口无数据可验")

    first = items[0]
    labels = (first.get("labels") or {})
    rule_group = labels.get("rule_group") or ""
    rule_level = labels.get("rule_level") or ""

    origin = ui.base_url.split('/kube-frontend/')[0] if hasattr(ui, 'base_url') else ui.base
    ui.page.goto(f"{origin}{MESSAGES}", wait_until="domcontentloaded")
    surface = ui.page.locator('[data-ai-id="cluster-alerting-messages:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    rows = surface.locator("tbody tr[data-ai-row]")
    expect(rows.first).to_be_visible(timeout=60_000)
    # Row actions live in the row's more-actions dropdown, so open it first.
    rows.first.locator("td").last.locator("button").first.click()
    ui.page.locator('[data-ai-id="cluster-alerting-messages:detail"]').last.click()

    detail = ui.page.locator('[data-ai-id="cluster-alerting-messages:detail"]').last
    expect(detail).to_be_visible(timeout=30_000)

    # The links section only exists when the alert names something linkable.
    links = ui.page.locator('[data-ai-id="alerts:detail:links"]')
    if rule_group or labels.get('pod') or labels.get('deployment'):
        # The workspace of the alert's namespace is one extra read, so give it time to land.
        expect(links).to_have_count(1, timeout=30_000)
    else:
        assert links.count() == 0, labels
    if rule_group:
        link = ui.page.locator('[data-ai-id="alerts:detail:rule-link"]').last
        expect(link).to_be_visible(timeout=30_000)
        href = link.get_attribute("href") or ""
        assert "/alertingrules/" in href, href
        target = href.split("/alertingrules/")[1]
        name, _, query = target.partition("?")
        assert name, href
        scope = query.split("scope=")[1] if "scope=" in query else ""
        assert scope in ("global", "cluster", "project"), href
        # The policy the message points at must exist in the collection its scope names.
        collection = {"global": "globalrulegroups", "cluster": "clusterrulegroups"}.get(scope)
        if collection:
            status, body = ui.api.request("GET", f"/apis/alerting.kubesphere.io/v2beta1/{collection}/{name}")
            assert status == 200, f"{collection}/{name} -> {status}: {str(body)[:200]}"
        link.click()
        expect(ui.page.locator('[data-ai-id="alertingrules:detail"]').last).to_be_visible(timeout=60_000)

    screenshot(ui.page, "alert-message-drilldown")

