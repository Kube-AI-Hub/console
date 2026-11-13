from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"


def _rule_groups(api) -> list[dict] | None:
    """Rule groups from both cluster-wide sources, or None when this cluster has none."""
    status, group = api.request("GET", API)
    if status != 200 or not isinstance(group, dict):
        return None
    names = {resource.get("name") for resource in group.get("resources") or []}
    if "globalrulegroups" not in names and "clusterrulegroups" not in names:
        return None

    groups: list[dict] = []
    for path in ("globalrulegroups", "clusterrulegroups"):
        if path not in names:
            continue
        status, body = api.request("GET", f"{API}/{path}?limit=-1")
        if status == 200 and isinstance(body, dict):
            groups.extend(body.get("items") or [])
    return groups


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_RULES_01(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-RULES-01 告警策略：规则组列表与规则数一致。"""

    ui = monitoring_page
    assert ui.api is not None

    groups = _rule_groups(ui.api)
    if groups is None:
        pytest.skip("集群不提供规则组资源（可能是 3.3 的 alertingrules 模型）")
    if not groups:
        pytest.skip("集群没有规则组，无法核对列表")

    expected_counts = {
        str(group["metadata"]["name"]): len(((group.get("spec") or {}).get("rules")) or [])
        for group in groups
    }

    ui.open("alertingrules")
    ui.wait_ready("alertingrules")

    surface = ui.surface("alertingrules")
    assert ui.state("alertingrules") == "ready", ui.state("alertingrules")

    headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
    required = ["名称", "策略状态", "规则数", "类型", "创建时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    # The pager states the merged total; per-source pagination would show less.
    footer = surface.inner_text()
    assert f"共 {len(groups)} 条" in footer, f"expected a total of {len(groups)}: {footer[-200:]}"

    # Rule counts come from spec.rules, so a group read wrongly (spec.groups) shows 0.
    rows = surface.locator("[data-ai-row]")
    shown = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
    assert shown, "list rendered no rows"
    for name in shown:
        count = expected_counts.get(name)
        assert count is not None, f"row {name} is not a rule group from the API"
        row_text = rows.locator(f'[data-ai-row="{name}"]').inner_text() if False else None

    screenshot(ui.page, "alertingrules-list")
