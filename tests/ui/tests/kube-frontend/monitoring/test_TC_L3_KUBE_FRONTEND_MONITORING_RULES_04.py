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


def _delete(api, name: str) -> None:
    api.request("DELETE", f"{API}/{name}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_04(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-04 告警策略：创建、编辑与删除项目策略。"""

    ui = monitoring_page
    assert ui.api is not None
    name = f"tc-e2e-rg-{uuid.uuid4().hex[:6]}"
    expression = "up == 0"
    edited = "up == 0 and vector(1)"

    try:
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")

        # ---- create ----
        create = ui.page.locator('[data-ai-id="alertingrules:create"]')
        expect(create).to_be_visible(timeout=20_000)
        create.click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-alert").fill("TcE2eAlert")
        ui.page.locator("#ai-field-expression").fill(expression)
        ui.page.locator("#ai-field-duration").fill("5m")
        ui.page.locator("#ai-field-summary").fill("created by the e2e case")
        dialog.get_by_role("button", name="提交").click()

        deadline = time.time() + 60
        created = None
        while time.time() < deadline:
            created = _group(ui.api, name)
            if created is not None:
                break
            time.sleep(1)
        assert created is not None, "创建后回读不到该规则组"
        rules = ((created.get("spec") or {}).get("rules")) or []
        assert len(rules) == 1, rules
        assert rules[0].get("alert") == "TcE2eAlert", rules[0]
        assert rules[0].get("expr") == expression, rules[0]

        # ---- edit ----
        ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
        ui.page.wait_for_timeout(1200)
        ui.wait_ready("alertingrules")
        row = ui.page.locator('[data-ai-id="alertingrules:surface"]').locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="编辑", exact=True).click()
        edit_dialog = ui.page.get_by_role("dialog")
        expect(edit_dialog).to_be_visible(timeout=20_000)
        # The name is locked while editing: renaming would be create-then-delete.
        expect(ui.page.locator("#ai-field-name")).to_be_disabled()
        ui.page.locator("#ai-field-expression").fill(edited)
        edit_dialog.get_by_role("button", name="提交").click()

        deadline = time.time() + 60
        updated = None
        while time.time() < deadline:
            updated = _group(ui.api, name)
            if updated and ((updated.get("spec") or {}).get("rules") or [{}])[0].get("expr") == edited:
                break
            time.sleep(1)
        assert updated is not None
        assert ((updated.get("spec") or {}).get("rules") or [{}])[0].get("expr") == edited, updated.get("spec")

        screenshot(ui.page, "alertingrules-write")

        # ---- delete ----
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        confirm.locator('[data-ai-id="alertingrules:delete-input"]').fill(name)
        confirm.locator('[data-ai-id="alertingrules:delete-confirm"]').click()

        deadline = time.time() + 60
        while time.time() < deadline:
            if _group(ui.api, name) is None:
                break
            time.sleep(1)
        assert _group(ui.api, name) is None, "删除后仍能读到该规则组"
    finally:
        _delete(ui.api, name)
