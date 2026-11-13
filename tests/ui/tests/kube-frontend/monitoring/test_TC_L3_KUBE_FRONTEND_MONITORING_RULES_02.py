from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui

ALERTING = "/kapis/alerting.kubesphere.io/v1alpha2/namespaces/default"
ENABLE_LABEL = "alerting.kubesphere.io/enable"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_02(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-02 告警策略：启用停用写入标签。"""

    ui = monitoring_page
    assert ui.api is not None

    # The alerting module is not installed on every cluster: its API answers 200 with
    # an empty body, and there is nothing to toggle. Say so instead of failing.
    status, existing = ui.api.request("GET", f"{ALERTING}/alertingrules?limit=1")
    if status != 200 or not isinstance(existing, dict) or not existing.get("items"):
        pytest.skip("告警模块未安装（接口返回空体），没有可切换的策略")

    name = existing["items"][0]["metadata"]["name"]
    before = ((existing["items"][0]["metadata"] or {}).get("labels") or {}).get(ENABLE_LABEL)
    try:
        ui.open("alertingrules")
        ui.wait_ready("alertingrules")
        ui.page.locator('[data-ai-id="alertingrules:search"]').last.fill(name)
        ui.page.wait_for_timeout(900)
        ui.wait_ready("alertingrules")

        row = ui.surface("alertingrules").locator(f'[data-ai-row="{name}"]')
        row.locator('button[aria-label="更多操作"]').click()
        ui.page.get_by_role("menuitem", name="启用/停用", exact=True).click()
        ui.page.wait_for_timeout(2500)

        status, after = ui.api.request("GET", f"{ALERTING}/alertingrules/{name}")
        assert status == 200
        now = ((after.get("metadata") or {}).get("labels") or {}).get(ENABLE_LABEL)
        # The first toggle always writes a value; the invariant is that it flipped.
        expected = "false" if str(before).lower() != "false" else "true"
        assert str(now).lower() == expected, (before, now)
        screenshot(ui.page, "monitoring-rules-toggle")
    finally:
        # Restore whatever the policy had, so the cluster is left as found.
        restore = "true" if str(before).lower() != "false" else "false"
        ui.api.request("PATCH", f"{ALERTING}/alertingrules/{name}", {"metadata": {"labels": {ENABLE_LABEL: restore}}})
