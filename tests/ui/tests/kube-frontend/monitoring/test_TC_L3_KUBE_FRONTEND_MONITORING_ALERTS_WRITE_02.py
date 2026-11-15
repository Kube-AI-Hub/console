from __future__ import annotations

import json
import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1/namespaces/default/rulegroups"
SSAR = "**/selfsubjectaccessreviews"


def _denied() -> dict:
    return {
        "apiVersion": "authorization.k8s.io/v1",
        "kind": "SelfSubjectAccessReview",
        "status": {"allowed": False},
    }


def _group(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{API}/{name}")
    return body if status == 200 and isinstance(body, dict) else None


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
def test_TC_L3_KUBE_FRONTEND_MONITORING_ALERTS_WRITE_02(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02 告警策略：SSAR 写权限门控。"""

    ui = monitoring_page
    assert ui.api is not None
    name = f"tc-e2e-perm-{uuid.uuid4().hex[:6]}"
    mode = {"value": "deny"}

    try:
        payload = {
            "apiVersion": "alerting.kubesphere.io/v2beta1",
            "kind": "RuleGroup",
            "metadata": {"name": name, "namespace": ui.namespace},
            "spec": {
                "rules": [
                    {
                        "alert": "TcPermRule",
                        "expr": "up == 0",
                        "for": "5m",
                        "severity": "warning",
                    }
                ]
            },
        }
        status, _ = ui.api.request("POST", API, payload)
        assert status in (200, 201), f"创建测试策略失败: {status}"
        assert _wait_for(ui.api, name, lambda group: group is not None), "创建后回读不到测试策略"

        def handle(route):
            if mode["value"] == "deny":
                route.fulfill(status=201, content_type="application/json", body=json.dumps(_denied()))
            elif mode["value"] == "error":
                route.fulfill(status=500, content_type="application/json", body='{"message":"injected failure"}')
            else:
                route.continue_()

        ui.page.route(SSAR, handle)

        # ---- denied: the entries that could only fail are not rendered, and the page says why ----
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")
        expect(ui.page.locator('[data-ai-id="alertingrules:no-create-permission"]')).to_be_visible(timeout=30_000)
        assert ui.page.locator('[data-ai-id="monitoring-alerts:create"]').count() == 0, "无 create 权限时仍显示创建入口"

        ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
        ui.page.wait_for_timeout(1200)
        ui.wait_ready("alertingrules")
        ui.open_row_menu(name)
        denied_items = ui.page.get_by_role("menuitem").all_inner_texts()
        assert "详情" in denied_items, denied_items
        for hidden in ("编辑", "删除", "启用", "停用"):
            assert hidden not in denied_items, f"无 update/delete 权限时仍显示 {hidden}: {denied_items}"
        ui.page.keyboard.press("Escape")

        ui.open_detail(name, scope="project")
        expect(ui.detail_surface()).to_be_visible(timeout=30_000)
        ui.wait_detail_ready()
        for ai_id in ("alertingrules:detail:edit", "alertingrules:detail:delete", "alertingrules:detail:toggle"):
            assert ui.page.locator(f'[data-ai-id="{ai_id}"]').count() == 0, f"无权限时详情仍显示 {ai_id}"

        screenshot(ui.page, "alertingrules-permission-denied")

        # ---- allowed: the same entries appear and the write path is the one the old cases cover ----
        mode["value"] = "allow"
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")
        expect(ui.page.locator('[data-ai-id="monitoring-alerts:create"]')).to_be_visible(timeout=30_000)
        ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
        ui.page.wait_for_timeout(1200)
        ui.wait_ready("alertingrules")
        ui.open_row_menu(name)
        allowed_items = ui.page.get_by_role("menuitem").all_inner_texts()
        for visible in ("详情", "编辑", "删除", "停用"):
            assert visible in allowed_items, f"有权限时缺少 {visible}: {allowed_items}"
        ui.page.keyboard.press("Escape")

        ui.open_detail(name, scope="project")
        ui.wait_detail_ready()
        for ai_id in ("alertingrules:detail:edit", "alertingrules:detail:delete", "alertingrules:detail:toggle"):
            expect(ui.page.locator(f'[data-ai-id="{ai_id}"]')).to_be_visible(timeout=20_000)

        screenshot(ui.page, "alertingrules-permission-allowed")

        # ---- a failed permission check must not take an allowed action away (fail-open) ----
        mode["value"] = "error"
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")
        expect(ui.page.locator('[data-ai-id="monitoring-alerts:create"]')).to_be_visible(timeout=30_000)
    finally:
        ui.api.request("DELETE", f"{API}/{name}")
