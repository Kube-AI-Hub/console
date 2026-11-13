from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1/namespaces/default/rulegroups"


def _group(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{API}/{name}")
    return body if status == 200 and isinstance(body, dict) else None


def _rules(group: dict | None) -> list[dict]:
    return ((group or {}).get("spec") or {}).get("rules") or []


def _wait_for(api, name: str, predicate, timeout: float = 60) -> dict | None:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = _group(api, name)
        if predicate(last):
            return last
        time.sleep(1)
    return last


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_04(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-04 告警策略：创建、编辑与删除项目策略（含规则列表）。"""

    ui = monitoring_page
    assert ui.api is not None
    name = f"tc-e2e-rg-{uuid.uuid4().hex[:6]}"

    try:
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")

        # ---- create a policy with two rules ----
        create = ui.page.locator('[data-ai-id="alertingrules:create"]')
        expect(create).to_be_visible(timeout=20_000)
        create.click()
        dialog = ui.page.locator('[data-ai-id="rule-group-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)

        ui.page.locator('[data-ai-id="rule-group:name"]').fill(name)
        ui.page.locator('[data-ai-id="rule-group:rule:0:alert"]').fill("TcRuleOne")
        ui.page.locator('[data-ai-id="rule-group:rule:0:expression"]').fill("up == 0")
        ui.page.locator('[data-ai-id="rule-group:add-rule"]').click()
        expect(ui.page.locator('[data-ai-id="rule-group:rule:1:alert"]')).to_be_visible(timeout=10_000)
        ui.page.locator('[data-ai-id="rule-group:rule:1:alert"]').fill("TcRuleTwo")
        ui.page.locator('[data-ai-id="rule-group:rule:1:expression"]').fill("up == 1")
        ui.page.locator('[data-ai-id="rule-group:save"]').click()

        created = _wait_for(ui.api, name, lambda group: len(_rules(group)) == 2)
        assert created is not None, "创建后回读不到该规则组"
        rules = _rules(created)
        # Both rules must survive the write: sending one and replacing spec.rules would
        # have deleted the other.
        assert [(rule.get("alert"), rule.get("expr")) for rule in rules] == [
            ("TcRuleOne", "up == 0"),
            ("TcRuleTwo", "up == 1"),
        ], rules

        # ---- edit the list: change one expression and remove the other rule ----
        ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
        ui.page.wait_for_timeout(1200)
        ui.wait_ready("alertingrules")
        row = ui.page.locator('[data-ai-id="alertingrules:surface"]').locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="编辑", exact=True).click()
        expect(dialog).to_be_visible(timeout=20_000)
        # The editor must show every rule the group has, or the next save deletes the
        # ones it did not show.
        expect(ui.page.locator('[data-ai-id="rule-group:rule:1:alert"]')).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="rule-group:name"]')).to_be_disabled()
        ui.page.locator('[data-ai-id="rule-group:rule:0:expression"]').fill("up == 2")
        ui.page.locator('[data-ai-id="rule-group:remove-rule:1"]').click()
        ui.page.locator('[data-ai-id="rule-group:save"]').click()

        edited = _wait_for(ui.api, name, lambda group: len(_rules(group)) == 1)
        rules = _rules(edited)
        assert [(rule.get("alert"), rule.get("expr")) for rule in rules] == [("TcRuleOne", "up == 2")], rules

        screenshot(ui.page, "alertingrules-rules")

        # ---- delete ----
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        confirm = ui.page.locator('[data-ai-id="alertingrules:delete-input"]')
        expect(confirm).to_be_visible(timeout=20_000)
        confirm.fill(name)
        ui.page.locator('[data-ai-id="alertingrules:delete-confirm"]').click()
        gone = _wait_for(ui.api, name, lambda group: group is None)
        assert gone is None, "删除后仍能读到该规则组"
    finally:
        ui.api.request("DELETE", f"{API}/{name}")
