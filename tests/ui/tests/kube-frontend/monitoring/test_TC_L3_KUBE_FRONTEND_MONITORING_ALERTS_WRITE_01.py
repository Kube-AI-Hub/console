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


def _description(group: dict | None) -> str:
    annotations = ((group or {}).get("metadata") or {}).get("annotations") or {}
    return str(annotations.get("kubesphere.io/description") or "")


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
def test_TC_L3_KUBE_FRONTEND_MONITORING_ALERTS_WRITE_01(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01 告警策略：创建（描述与规则）、编辑描述与级别、删除。"""

    ui = monitoring_page
    assert ui.api is not None
    name = f"tc-e2e-policy-{uuid.uuid4().hex[:6]}"
    description = f"e2e policy {name}"
    updated = f"{description} updated"

    try:
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")

        # ---- create: name + description + one rule ----
        create = ui.page.locator('[data-ai-id="monitoring-alerts:create"]')
        expect(create).to_be_visible(timeout=20_000)
        create.click()
        dialog = ui.page.locator('[data-ai-id="monitoring-alerts:dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)

        ui.page.locator('[data-ai-id="monitoring-alerts:name"]').fill(name)
        ui.page.locator('[data-ai-id="monitoring-alerts:description"]').fill(description)
        ui.page.locator('[data-ai-id="monitoring-alerts:rule:0:alert"]').fill("TcWriteRule")
        ui.page.locator('[data-ai-id="monitoring-alerts:rule:0:expression"]').fill("up == 0")
        ui.page.locator('[data-ai-id="monitoring-alerts:rule:0:duration"]').fill("5m")
        ui.page.locator('[data-ai-id="monitoring-alerts:rule:0:summary"]').fill("up is down")
        ui.page.locator('[data-ai-id="monitoring-alerts:rule:0:message"]').fill("target is unreachable")
        ui.page.locator('[data-ai-id="monitoring-alerts:save"]').click()

        created = _wait_for(ui.api, name, lambda group: len(_rules(group)) == 1)
        assert created is not None, "创建后回读不到该规则组"
        # The description is an annotation, not a spec field: assert the key the old
        # console and the platform actually read.
        assert _description(created) == description, created.get("metadata")
        rule = _rules(created)[0]
        assert rule.get("alert") == "TcWriteRule", rule
        assert rule.get("expr") == "up == 0", rule
        assert rule.get("for") == "5m", rule
        assert rule.get("severity") == "warning", rule
        annotations = rule.get("annotations") or {}
        assert annotations.get("summary") == "up is down", annotations
        assert annotations.get("message") == "target is unreachable", annotations

        # ---- the policy shows up in the list ----
        ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
        ui.page.wait_for_timeout(1200)
        ui.wait_ready("alertingrules")
        row = ui.page.locator('[data-ai-id="alertingrules:surface"]').locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)

        # ---- edit: description and rule severity ----
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="编辑", exact=True).click()
        expect(dialog).to_be_visible(timeout=20_000)
        # The editor must load the stored description, or saving would erase it.
        expect(ui.page.locator('[data-ai-id="monitoring-alerts:description"]')).to_have_value(description)
        ui.page.locator('[data-ai-id="monitoring-alerts:description"]').fill(updated)

        severity = ui.page.locator('[data-ai-id="monitoring-alerts:rule:0:severity"]')
        severity.click()
        ui.page.get_by_role("option", name="严重", exact=True).click()
        ui.page.locator('[data-ai-id="monitoring-alerts:save"]').click()

        edited = _wait_for(
            ui.api,
            name,
            lambda group: _description(group) == updated and bool(_rules(group)),
        )
        assert edited is not None, "编辑后回读不到该规则组"
        assert _description(edited) == updated, edited.get("metadata")
        edited_rule = _rules(edited)[0]
        assert edited_rule.get("severity") == "critical", edited_rule
        assert edited_rule.get("alert") == "TcWriteRule", edited_rule
        assert (edited_rule.get("annotations") or {}).get("message") == "target is unreachable", edited_rule

        screenshot(ui.page, "alertingrules-write")

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
