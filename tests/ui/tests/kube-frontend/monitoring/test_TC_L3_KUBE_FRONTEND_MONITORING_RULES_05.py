from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"


def _groups_with_rules(api) -> list[dict]:
    status, body = api.request("GET", f"{API}/globalrulegroups?limit=-1")
    if status != 200 or not isinstance(body, dict):
        return []
    return [group for group in body.get("items") or [] if (group.get("spec") or {}).get("rules")]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_05(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-05 告警策略详情：身份信息、规则逐条与当前状态。"""

    ui = monitoring_page
    assert ui.api is not None

    groups = _groups_with_rules(ui.api)
    if not groups:
        pytest.skip("集群没有含规则的规则组，无法核对详情页")

    target = groups[0]
    name = target["metadata"]["name"]
    rules = ((target.get("spec") or {}).get("rules")) or []

    ui.open("alertingrules")
    ui.wait_ready("alertingrules")
    ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
    ui.page.wait_for_timeout(1200)
    ui.wait_ready("alertingrules")
    ui.open_row_menu(name)
    ui.page.get_by_role("menuitem", name="详情", exact=True).click()

    detail = ui.detail_surface()
    expect(detail).to_be_visible(timeout=30_000)
    ui.wait_detail_ready()
    assert ui.detail_state() == "ready", ui.detail_state()

    # A route detail, not a modal: the URL names the policy and the scope it was read from.
    assert f"/alertingrules/{name}" in ui.page.url, ui.page.url
    assert "scope=global" in ui.page.url, ui.page.url

    # Identity comes before the rule list; the scope is part of it because the project list
    # merges three collections and the same name can exist in more than one.
    attributes = ui.detail_attributes()
    for label in ("名称", "作用域", "策略状态", "类型", "规则数"):
        assert label in attributes, f"详情缺少 {label}: {attributes[:300]}"

    table = ui.detail_rule_table()
    expect(table).to_be_visible(timeout=20_000)
    assert table.locator("tbody tr").count() == len(rules), (
        f"规则行数 {table.locator('tbody tr').count()} 与接口 spec.rules 的 {len(rules)} 不一致"
    )

    first = rules[0]
    expected_name = str(first.get("alert") or first.get("record") or "")
    table_text = table.inner_text()
    assert expected_name in table_text, f"第一条规则 {expected_name} 没有出现在详情里"
    # The expression is the rule's threshold; truncating it hides the condition.
    expression = str(first.get("expr") or "").strip().splitlines()[0][:24]
    if expression:
        assert expression in table_text, f"规则表达式没有显示: {expression!r}"
    # The state column is derived from active alerts; it must show one of the three words,
    # never a fabricated number or a blank.
    assert any(state in table_text for state in ("告警中", "待触发", "正常")), table_text[:300]

    screenshot(ui.page, "alertingrules-detail-page")

    ui.page.locator('[data-ai-id="alertingrules:detail:back"]').click()
    expect(ui.surface("alertingrules")).to_be_visible(timeout=30_000)
