from __future__ import annotations

import json
import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NODE_RANK = "**/monitoring.kubesphere.io/v1alpha3/nodes**"

#: The metric the panel opens with, and one it can be switched to.
DEFAULT_METRIC = "node_cpu_utilisation"
OTHER_METRIC = "node_memory_utilisation"
OTHER_LABEL = "内存使用率"


def _values_match(exported: dict, expected: dict) -> bool:
    """Every value the export carries equals the API's number for that node."""
    if not exported:
        return False
    for key, value in exported.items():
        if key not in expected:
            return False
        if abs(float(value) - float(expected[key])) > 1e-6:
            return False
    return True


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_16(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-16 集群监控资源用量排行页签与 JSON 导出。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    api_rows = ui.node_ranking_rows(DEFAULT_METRIC, "desc")
    assert api_rows, "host 节点排行不应为空"
    api_by_name = {row["name"]: row["values"] for row in api_rows}
    api_order = [row["name"] for row in api_rows]

    ui.open("ranking")
    ui.wait_ready()
    expect(ui.ranking_surface()).to_be_visible(timeout=60_000)

    # ---- the table shows the same rows, in the API's order ----
    rows = ui.ranking_row_names()
    assert rows, "排行表格没有行"
    assert rows == api_order[: len(rows)], f"表格行 {rows} vs 接口顺序 {api_order}"

    # ---- export: file name, JSON shape, and every row rather than the page ----
    export = ui.ranking_export()
    expect(export).to_be_visible(timeout=30_000)
    expect(export).to_be_enabled()
    with ui.page.expect_download(timeout=60_000) as download_info:
        export.click()
    download = download_info.value
    assert download.suggested_filename == "node.usage.rank.json", download.suggested_filename
    path = download.path()
    assert path is not None
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload.get("cluster") == ui.cluster, payload.get("cluster")
    assert payload.get("metric") == DEFAULT_METRIC, payload.get("metric")
    assert payload.get("order") == "desc", payload.get("order")
    assert re.match(r"^\d{4}-\d{2}-\d{2}T", str(payload.get("generatedAt") or "")), payload.get("generatedAt")
    items = payload.get("items")
    assert isinstance(items, list) and items, "导出 items 为空"
    assert len(items) == len(api_rows), f"导出 {len(items)} 行，接口 {len(api_rows)} 行（应为全量而非当前页）"
    exported_names = [str(item.get("name")) for item in items]
    assert exported_names == api_order, f"导出顺序 {exported_names} vs 接口 {api_order}"
    for item in items:
        name = str(item.get("name"))
        assert isinstance(item.get("values"), dict), f"{name} 缺少 values"
        assert _values_match(item["values"], api_by_name[name]), f"{name} values 与接口不一致: {item['values']}"

    screenshot(ui.page, "cluster-monitor-ranking")

    # ---- switching metric re-queries the table and the export follows it ----
    ui.ranking_metric_select().click()
    ui.page.get_by_role("option", name=OTHER_LABEL, exact=True).click()
    expect(ui.ranking_surface()).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    other_api = ui.node_ranking_rows(OTHER_METRIC, "desc")
    other_by_name = {row["name"]: row["values"] for row in other_api}
    with ui.page.expect_download(timeout=60_000) as download_info2:
        ui.ranking_export().click()
    payload2 = json.loads(download_info2.value.path().read_text(encoding="utf-8"))
    assert payload2.get("metric") == OTHER_METRIC, payload2.get("metric")
    assert [str(item.get("name")) for item in payload2.get("items") or []] == [row["name"] for row in other_api]
    for item in payload2.get("items") or []:
        name = str(item.get("name"))
        assert _values_match(item.get("values") or {}, other_by_name[name]), name

    # ---- no data: export disabled and labelled, table shows the empty state ----
    ui.page.route(NODE_RANK, lambda route: route.fulfill(status=200, json={"total_item": 0, "results": []}))
    try:
        ui.open("ranking")
        ui.wait_ready()
        expect(ui.ranking_export()).to_be_disabled(timeout=30_000)
        empty_hint = (ui.ranking_export().get_attribute("title") or "") + (ui.ranking_export().get_attribute("aria-label") or "")
        assert "没有可导出" in empty_hint or "没有可导出" in ui.ranking_surface().inner_text(), (
            f"空数据时应提示不可导出: title={empty_hint!r}"
        )
        assert ui.ranking_row_names() == [], "空数据时不应渲染排行行"
        screenshot(ui.page, "cluster-monitor-ranking-empty")
    finally:
        ui.page.unroute(NODE_RANK)

    # ---- the independent node-usage page gets the same export ----
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/node-usage")
    node_usage_export = ui.page.locator('[data-ai-id="node-usage:export"]')
    expect(node_usage_export).to_be_visible(timeout=60_000)
    expect(node_usage_export).to_be_enabled()
