from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

API = "/apis/alerting.kubesphere.io/v2beta1"
KAPIS = "/kapis/alerting.kubesphere.io/v2beta1"
LIST = "alerting-policies"

STATE_LABELS = {
    "inactive": "未触发",
    "pending": "验证中",
    "firing": "已触发",
    "disabled": "已禁用",
}


def _collection(api, path: str) -> dict:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status} {body}"
    return body


def _get_group(api, name: str) -> dict:
    status, body = api.request("GET", f"{API}/clusterrulegroups/{name}")
    assert status == 200 and isinstance(body, dict), f"GET {name} -> {status} {body}"
    return body


def _delete_group(api, name: str) -> None:
    """Best-effort cleanup: only this run's uniquely named objects."""
    api.request("DELETE", f"{API}/clusterrulegroups/{name}")


def _pick_option(page, ai_id: str, label: str) -> None:
    page.locator(f'[data-ai-id="{ai_id}"]').click()
    option = page.locator('[role="option"]', has_text=label).first
    expect(option).to_be_visible(timeout=20_000)
    option.click()


def _search(page, value: str) -> None:
    page.locator('[data-ai-id="cluster-alerting-policies:search"]').fill(value)
    # The list debounces the search by 250 ms; wait for the filtered rows rather than
    # reading the table mid-debounce.
    page.wait_for_timeout(700)


def _open_create(page):
    page.locator('[data-ai-id="cluster-alerting-policies:create"]').click()
    dialog = page.locator('[data-ai-id="monitoring-alerts:dialog"]')
    expect(dialog).to_be_visible(timeout=20_000)
    return dialog


def _create(page, *, name: str, alias: str, alert: str, expression: str) -> None:
    dialog = _open_create(page)
    page.locator('[data-ai-id="monitoring-alerts:name"]').fill(name)
    page.locator('[data-ai-id="monitoring-alerts:alias"]').fill(alias)
    page.locator('[data-ai-id="monitoring-alerts:interval"]').fill("3")
    page.locator('[data-ai-id="monitoring-alerts:description"]').fill("自动化检查用的临时策略")
    page.locator('[data-ai-id="monitoring-alerts:rule:0:alert"]').fill(alert)
    page.locator('[data-ai-id="monitoring-alerts:rule:0:expression"]').fill(expression)
    page.locator('[data-ai-id="monitoring-alerts:rule:0:duration"]').fill("1m")
    page.locator('[data-ai-id="monitoring-alerts:rule:0:summary"]').fill("自动化检查规则")
    page.locator('[data-ai-id="monitoring-alerts:save"]').click()
    expect(dialog).to_have_count(0, timeout=30_000)
    expect(page.locator(f'[data-ai-row="{name}"]')).to_be_visible(timeout=30_000)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_ALERTING_WRITE_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03 集群告警策略：状态列表、详情与自定义策略生命周期。"""

    ui = cluster_management_page
    assert ui.api is not None
    stamp = int(time.time())
    name_a = f"ui-check-{stamp}-a"
    name_b = f"ui-check-{stamp}-b"
    alias_a = f"UI检查A{stamp % 100000}"
    alias_b = f"UI检查B{stamp % 100000}"
    alert = f"UiCheckAlert{stamp % 100000}"
    names = (name_a, name_b)

    custom = _collection(ui.api, f"{KAPIS}/clusterrulegroups?limit=-1")
    builtin = _collection(ui.api, f"{KAPIS}/globalrulegroups?limit=-1")
    if not (custom.get("items") or builtin.get("items")):
        pytest.skip("集群没有告警策略，无法验证集群告警页")

    ui.page.goto(ui.url(LIST))
    surface = ui.page.locator('[data-ai-id="cluster-alerting-policies:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    # ---- tab counts mirror the API's totalItems ----
    custom_count = custom.get("totalItems", len(custom.get("items") or []))
    builtin_count = builtin.get("totalItems", len(builtin.get("items") or []))
    expect(ui.page.locator('[data-ai-id="cluster-alerting-policies:tab:custom"]')).to_contain_text(str(custom_count), timeout=30_000)
    expect(ui.page.locator('[data-ai-id="cluster-alerting-policies:tab:builtin"]')).to_contain_text(str(builtin_count), timeout=30_000)

    headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
    for label in ("规则状态", "耗时", "最近检查", "策略状态"):
        assert label in headers, f"表头缺少 {label}: {headers}"

    # ---- status columns agree with the aggregated kapis status ----
    for item in (custom.get("items") or [])[:3]:
        row_name = item["metadata"]["name"]
        row = surface.locator(f'[data-ai-row="{row_name}"]')
        expect(row).to_be_visible(timeout=20_000)
        text = row.inner_text()
        status = item.get("status") or {}
        stats = status.get("rulesStats") or {}
        for state, label in STATE_LABELS.items():
            if state in stats:
                assert f"{label} {stats[state]}" in text, f"{row_name} 缺少 {label} {stats[state]}: {text[:300]}"
        if isinstance(status.get("evaluationTime"), (int, float)):
            assert f"{status['evaluationTime']:.3f} 秒" in text, f"{row_name} 耗时不符: {text[:300]}"

    screenshot(ui.page, "cluster-alerting-policies-status")

    # ---- rule-state filter is client-side over the whole collection ----
    ui.page.locator('[data-ai-id="cluster-alerting-policies:tab:builtin"]').click()
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    firing_items = [
        item for item in (builtin.get("items") or []) if (item.get("status") or {}).get("rulesStats", {}).get("firing", 0) > 0
    ]
    expected_firing = min(10, len(firing_items))
    _pick_option(ui.page, "cluster-alerting-policies:filter:rule-state", "已触发")
    ui.page.wait_for_timeout(800)
    assert surface.locator("[data-ai-row]").count() == expected_firing, "规则状态筛选结果与 kapis 计数不一致"
    _pick_option(ui.page, "cluster-alerting-policies:filter:rule-state", "全部")
    ui.page.wait_for_timeout(500)

    # ---- create two custom policies (bulk needs more than one) ----
    ui.page.locator('[data-ai-id="cluster-alerting-policies:tab:custom"]').click()
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    try:
        _create(ui.page, name=name_a, alias=alias_a, alert=alert, expression="up == 0")
        _create(ui.page, name=name_b, alias=alias_b, alert=alert + "B", expression="up == 0")
        screenshot(ui.page, "cluster-alerting-policies-created")

        # API read-back: annotations, interval and rules are what the form submitted.
        created = _get_group(ui.api, name_a)
        annotations = (created.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == alias_a, annotations
        assert annotations.get("kubesphere.io/description") == "自动化检查用的临时策略", annotations
        spec = created.get("spec") or {}
        assert spec.get("interval") == "3m", spec.get("interval")
        assert spec["rules"][0]["alert"] == alert, spec.get("rules")

        # ---- detail: attributes, rule state, metric chart dialog ----
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/alerting-policies/{name_a}?scope=cluster")
        detail = ui.page.locator('[data-ai-id="alertingrules:detail"]').last
        expect(detail).to_be_visible(timeout=30_000)
        detail_text = detail.inner_text()
        for label in ("别名", "检查间隔", "耗时", "最近检查", "规则", "告警消息"):
            assert label in detail_text, f"详情缺少 {label}: {detail_text[:400]}"
        assert alias_a in detail_text and alert in detail_text

        metric_link = ui.page.locator(f'[data-ai-id="alertingrules:detail:rule-metric:{alert}"]')
        expect(metric_link).to_be_visible(timeout=20_000)
        metric_link.click()
        chart = ui.page.locator('[data-ai-id="alertingrules:metric:chart"]')
        expect(chart).to_be_visible(timeout=20_000)
        expect(chart).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        chart_state = chart.get_attribute("data-ai-state")
        assert chart_state in ("empty", "ready", "error"), chart_state
        if chart_state == "error":
            expect(ui.page.locator('[data-ai-id="alertingrules:metric:error"]')).to_be_visible(timeout=10_000)
        screenshot(ui.page, "cluster-alerting-policy-metric")
        ui.page.locator('[data-ai-id="alertingrules:metric:close"]').click()
        expect(chart).to_have_count(0, timeout=20_000)

        # ---- edit: alias + description ----
        edited_alias = alias_a + "-改"
        ui.page.locator('[data-ai-id="alertingrules:detail:edit"]').click()
        dialog = ui.page.locator('[data-ai-id="monitoring-alerts:dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="monitoring-alerts:alias"]').fill(edited_alias)
        ui.page.locator('[data-ai-id="monitoring-alerts:description"]').fill("编辑后的临时策略")
        ui.page.locator('[data-ai-id="monitoring-alerts:save"]').click()
        expect(dialog).to_have_count(0, timeout=30_000)
        expect(ui.page.locator('[data-ai-id="alertingrules:detail"]').last).to_contain_text(edited_alias, timeout=20_000)
        edited = _get_group(ui.api, name_a)
        edited_annotations = (edited.get("metadata") or {}).get("annotations") or {}
        assert edited_annotations.get("kubesphere.io/alias-name") == edited_alias, edited_annotations
        assert edited_annotations.get("kubesphere.io/description") == "编辑后的临时策略", edited_annotations

        # ---- disable asks once, then the label reads back false; enable reads true ----
        ui.page.locator('[data-ai-id="alertingrules:detail:toggle"]').click()
        confirm = ui.page.locator('[data-ai-id="alertingrules:detail:disable-dialog"]')
        expect(confirm).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="alertingrules:detail:disable-confirm"]').click()
        expect(confirm).to_have_count(0, timeout=20_000)
        expect(ui.page.locator('[data-ai-id="alertingrules:detail"]').last).to_contain_text("已停用", timeout=30_000)
        disabled = (_get_group(ui.api, name_a).get("metadata") or {}).get("labels") or {}
        assert disabled.get("alerting.kubesphere.io/enable") == "false", disabled
        ui.page.locator('[data-ai-id="alertingrules:detail:toggle"]').click()
        expect(ui.page.locator('[data-ai-id="alertingrules:detail"]').last).to_contain_text("已启用", timeout=30_000)
        enabled = (_get_group(ui.api, name_a).get("metadata") or {}).get("labels") or {}
        assert enabled.get("alerting.kubesphere.io/enable") == "true", enabled

        # ---- YAML edit changes the alias annotation; name stays locked ----
        ui.page.locator('[data-ai-id="alertingrules:detail:edit-yaml"]').click()
        editor = ui.page.locator(".cm-content")
        expect(editor).to_be_visible(timeout=30_000)
        alias_line = ui.page.locator(".cm-line", has_text="kubesphere.io/alias-name").first
        expect(alias_line).to_be_visible(timeout=20_000)
        box = alias_line.bounding_box()
        ui.page.mouse.click(box["x"] + box["width"] - 4, box["y"] + box["height"] / 2)
        ui.page.keyboard.press("End")
        ui.page.keyboard.type("-yaml", delay=30)
        ui.page.locator('[data-ai-id="yaml:submit"]').click()
        expect(ui.page.locator('[data-ai-id="yaml:submit"]')).to_have_count(0, timeout=30_000)
        yaml_saved = _get_group(ui.api, name_a)
        yaml_alias = ((yaml_saved.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name")
        assert yaml_alias == edited_alias + "-yaml", yaml_alias

        # ---- bulk disable (confirm) then bulk enable ----
        ui.page.goto(ui.url(LIST))
        surface = ui.page.locator('[data-ai-id="cluster-alerting-policies:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        _search(ui.page, name_a.rsplit("-", 1)[0])
        for target in names:
            box_locator = ui.page.locator(f'[data-ai-row="{target}"] input[type="checkbox"]')
            expect(box_locator.first).to_be_visible(timeout=20_000)
            box_locator.first.check()
        ui.page.locator('[data-ai-id="cluster-alerting-policies:bulk-disable"]').click()
        bulk_confirm = ui.page.locator('[data-ai-id="cluster-alerting-policies:disable-dialog"]')
        expect(bulk_confirm).to_be_visible(timeout=20_000)
        screenshot(ui.page, "cluster-alerting-bulk-disable-confirm")
        ui.page.locator('[data-ai-id="cluster-alerting-policies:disable-confirm"]').click()
        expect(bulk_confirm).to_have_count(0, timeout=30_000)
        ui.page.wait_for_timeout(1_500)
        for target in names:
            labels = (_get_group(ui.api, target).get("metadata") or {}).get("labels") or {}
            assert labels.get("alerting.kubesphere.io/enable") == "false", (target, labels)
        ui.page.locator('[data-ai-id="cluster-alerting-policies:bulk-enable"]').click()
        ui.page.wait_for_timeout(1_500)
        for target in names:
            labels = (_get_group(ui.api, target).get("metadata") or {}).get("labels") or {}
            assert labels.get("alerting.kubesphere.io/enable") == "true", (target, labels)

        # ---- delete A from its detail page: typed name is required ----
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/alerting-policies/{name_a}?scope=cluster")
        expect(ui.page.locator('[data-ai-id="alertingrules:detail"]').last).to_be_visible(timeout=30_000)
        ui.page.locator('[data-ai-id="alertingrules:detail:delete"]').click()
        ui.page.locator('[data-ai-id="alertingrules:delete-input"]').fill(name_a)
        ui.page.locator('[data-ai-id="alertingrules:delete-confirm"]').click()
        ui.page.wait_for_timeout(2_000)
        status, _ = ui.api.request("GET", f"{API}/clusterrulegroups/{name_a}")
        assert status == 404, f"删除后对象仍存在: {status}"

        # ---- delete B from the list row menu ----
        ui.page.goto(ui.url(LIST))
        surface = ui.page.locator('[data-ai-id="cluster-alerting-policies:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        _search(ui.page, name_b.rsplit("-", 1)[0])
        row = ui.page.locator(f'[data-ai-row="{name_b}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        ui.page.locator('[data-ai-id="alertingrules:delete-input"]').fill(name_b)
        ui.page.locator('[data-ai-id="alertingrules:delete-confirm"]').click()
        ui.page.wait_for_timeout(2_000)
        status, _ = ui.api.request("GET", f"{API}/clusterrulegroups/{name_b}")
        assert status == 404, f"删除后对象仍存在: {status}"
        screenshot(ui.page, "cluster-alerting-deleted")
    finally:
        for name in names:
            _delete_group(ui.api, name)
