from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"
ENABLE_LABEL = "alerting.kubesphere.io/enable"


def _group(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{API}/globalrulegroups/{name}")
    return body if status == 200 and isinstance(body, dict) else None


def _patch_label(api, name: str, value: str | None) -> int:
    status, _ = api.request(
        "PATCH",
        f"{API}/globalrulegroups/{name}",
        {"metadata": {"labels": {ENABLE_LABEL: value}}},
        "application/merge-patch+json",
    )
    return status


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_02(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-02 告警策略：启用停用只改标签。"""

    ui = monitoring_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{API}/globalrulegroups?limit=1")
    if status != 200 or not isinstance(body, dict) or not body.get("items"):
        pytest.skip("集群没有可切换的规则组")

    name = body["items"][0]["metadata"]["name"]
    original = _group(ui.api, name)
    assert original is not None
    original_label = ((original["metadata"].get("labels") or {}).get(ENABLE_LABEL))
    original_rules = ((original.get("spec") or {}).get("rules")) or []

    if str(original_label) == "false":
        # Start from "enabled" so the menu shows 停用; the finally restores either way.
        assert _patch_label(ui.api, name, "true") == 200

    try:
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")
        ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
        ui.page.wait_for_timeout(1200)
        ui.wait_ready("alertingrules")

        row = ui.surface("alertingrules").locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=20_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="停用", exact=True).click()
        ui.page.wait_for_timeout(2500)

        after = _group(ui.api, name)
        assert after is not None
        assert str((after["metadata"].get("labels") or {}).get(ENABLE_LABEL)) == "false", (
            "停用后 enable 标签不是 false：写成了 annotation，或请求没有发出去"
        )
        # The switch must not carry the rule body with it.
        assert ((after.get("spec") or {}).get("rules")) or [] == original_rules, "停用操作改动了规则体"

        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="启用", exact=True).click()
        ui.page.wait_for_timeout(2500)
        restored = _group(ui.api, name)
        assert str((restored["metadata"].get("labels") or {}).get(ENABLE_LABEL)) == "true"

        screenshot(ui.page, "alertingrules-toggle")
    finally:
        _patch_label(ui.api, name, original_label)
