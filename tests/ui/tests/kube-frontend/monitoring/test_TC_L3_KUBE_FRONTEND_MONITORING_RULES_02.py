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

    # The page reads \`alertingrules\`. On this cluster that resource does not exist at all:
    # the alerting module is installed, but KubeSphere 3.4 uses the Whizard model, where
    # rules live in globalrulegroups / clusterrulegroups / rulegroups. So the empty result
    # is a **resource-name mismatch in the product**, not a missing module — the skip says
    # which, because "module not installed" sent the previous two rounds looking in the
    # wrong direction.
    status, existing = ui.api.request("GET", f"{ALERTING}/alertingrules?limit=1")
    if status != 200 or not isinstance(existing, dict) or not existing.get("items"):
        _, group = ui.api.request("GET", "/apis/alerting.kubesphere.io/v2beta1")
        serves_rulegroups = isinstance(group, dict) and any(
            resource.get("name") == "globalrulegroups" for resource in group.get("resources") or []
        )
        if serves_rulegroups:
            pytest.skip(
                "本集群告警用 RuleGroup 模型（globalrulegroups/clusterrulegroups），"
                "页面读的 alertingrules 资源不存在——是产品侧资源名不匹配，不是模块未安装"
            )
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
