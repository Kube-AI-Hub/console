from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1/namespaces/default/rulegroups"
ENABLE = "alerting.kubesphere.io/enable"


def _create(api, name: str) -> None:
    body = {
        "apiVersion": "alerting.kubesphere.io/v2beta1",
        "kind": "RuleGroup",
        "metadata": {"name": name, "annotations": {"kubesphere.io/description": f"e2e bulk {name}"}},
        "spec": {"rules": [{"alert": "TcBulkRule", "expr": "up == 0", "for": "5m", "labels": {"severity": "warning"}, "annotations": {"summary": "bulk", "message": "bulk"}}]},
    }
    status, created = api.request("POST", API, body)
    assert status in (200, 201), f"create {name} -> {status}: {str(created)[:300]}"


def _delete(api, name: str) -> None:
    api.request("DELETE", f"{API}/{name}")


def _enabled(api, name: str) -> str | None:
    status, body = api.request("GET", f"{API}/{name}")
    if status != 200 or not isinstance(body, dict):
        return None
    labels = (body.get("metadata") or {}).get("labels") or {}
    return labels.get(ENABLE, "true")


def _wait_enabled(api, names: list[str], expected: str, timeout: float = 60) -> list[str | None]:
    deadline = time.time() + timeout
    states: list[str | None] = []
    while time.time() < deadline:
        states = [_enabled(api, name) for name in names]
        if all(value == expected for value in states):
            return states
        time.sleep(1)
    return states


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_07(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-07 告警策略：批量启用与停用。"""

    ui = monitoring_page
    assert ui.api is not None
    suffix = uuid.uuid4().hex[:6]
    names = [f"tc-e2e-bulk-{suffix}-a", f"tc-e2e-bulk-{suffix}-b"]
    try:
        for name in names:
            _create(ui.api, name)

        ui.open("alertingrules")
        ui.wait_ready("alertingrules")

        for name in names:
            row = ui.page.locator(f'[data-ai-row="{name}"]')
            expect(row).to_have_count(1, timeout=60_000)
            # A row may only be checkable when the identity may write it (AC text).
            box = row.locator('input[type="checkbox"]')
            assert box.count() == 1, f"{name} 没有复选框"
            box.first.check()

        bulk_disable = ui.page.locator('[data-ai-id="alertingrules:bulk-disable"]')
        expect(bulk_disable).to_be_visible(timeout=30_000)
        bulk_disable.click()

        states = _wait_enabled(ui.api, names, "false")
        assert states == ["false", "false"], states
        notice = ui.page.locator('[data-ai-id="alertingrules:bulk-result"]')
        expect(notice).to_be_visible(timeout=30_000)
        assert "2" in notice.inner_text(), notice.inner_text()

        # Re-select (the list clears the selection after a bulk action) and enable again.
        for name in names:
            ui.page.locator(f'[data-ai-row="{name}"] input[type="checkbox"]').first.check()
        ui.page.locator('[data-ai-id="alertingrules:bulk-enable"]').click()
        states = _wait_enabled(ui.api, names, "true")
        assert states == ["true", "true"], states

        screenshot(ui.page, "alerting-bulk")
    finally:
        for name in names:
            _delete(ui.api, name)

