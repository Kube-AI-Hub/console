from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_03(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-03 告警策略：详情列出每条规则。"""

    ui = monitoring_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{API}/globalrulegroups?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("集群不提供 globalrulegroups")

    groups = body.get("items") or []
    target = next((group for group in groups if ((group.get("spec") or {}).get("rules"))), None)
    if target is None:
        pytest.skip("没有含规则的规则组，无法核对详情")

    name = target["metadata"]["name"]
    rules = ((target.get("spec") or {}).get("rules")) or []
    first = rules[0]

    ui.open("alertingrules")
    ui.wait_ready("alertingrules")
    ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
    ui.page.wait_for_timeout(1200)
    ui.wait_ready("alertingrules")

    row = ui.surface("alertingrules").locator(f'[data-ai-row="{name}"]')
    expect(row).to_be_visible(timeout=20_000)
    row.locator('button[aria-haspopup="menu"]').click()
    ui.page.get_by_role("menuitem", name="详情", exact=True).click()

    detail = ui.page.locator('[data-ai-id="alertingrules:detail"]')
    expect(detail).to_be_visible(timeout=30_000)

    # The panel must state the group's own identity before the rule list.
    text = detail.inner_text()
    for label in ("名称", "策略状态", "类型", "规则数"):
        assert label in text, f"详情缺少 {label}: {text[:200]}"

    table = detail.locator('[data-ai-id="alertingrules:detail:rule-table"]')
    expect(table).to_be_visible(timeout=20_000)
    assert table.locator("tbody tr").count() == len(rules), (
        f"规则行数 {table.locator('tbody tr').count()} 与接口的 {len(rules)} 不一致"
    )

    expected_name = str(first.get("alert") or first.get("record") or "")
    row_text = table.inner_text()
    assert expected_name in row_text, f"第一条规则 {expected_name} 没有出现在详情里"
    # The expression is the reason to open this panel; a truncated one drops the
    # condition that matters, so its presence is asserted rather than assumed.
    expression = str(first.get("expr") or "").strip().splitlines()[0][:24]
    if expression:
        assert expression in row_text, f"规则表达式没有显示: {expression!r}"

    screenshot(ui.page, "alertingrules-detail")
