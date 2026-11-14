from __future__ import annotations

import math
import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NODE_METRICS = "/kapis/monitoring.kubesphere.io/v1alpha3/nodes"
PERCENT = re.compile(r"^(\d+)%$")


def _rank_rows(body, metric):
    series = body.get("results", [])
    target = next(result for result in series if result["metric_name"] == metric)
    names, values = [], {}
    for result in [target, *series]:
        key = result.get("metric_name")
        for sample in result.get("data", {}).get("result", []):
            name = sample.get("metric", {}).get("node")
            if not name:
                continue
            if name not in names:
                names.append(name)
            raw = sample.get("value", [None, None])[1]
            if raw is None or str(raw).strip() == "":
                continue
            value = float(raw)
            if math.isfinite(value):
                values.setdefault(name, {})[key] = value
    return names, values


def _node_usage(api) -> dict[str, float] | None:
    """CPU fraction per node, straight from the monitoring API."""
    metrics = "|".join(
        f"{name}$"
        for name in ("node_cpu_utilisation", "node_memory_utilisation", "node_disk_size_utilisation", "node_pod_running_count")
    )
    status, body = api.request("GET", f"{NODE_METRICS}?cluster=host&limit=-1&metrics_filter={metrics}")
    if status != 200 or not isinstance(body, dict):
        return None
    cpu: dict[str, float] = {}
    for result in body.get("results") or []:
        if result.get("metric_name") != "node_cpu_utilisation":
            continue
        for sample in ((result.get("data") or {}).get("result")) or []:
            node = (sample.get("metric") or {}).get("node")
            raw = (sample.get("value") or [None, None])[1]
            if node and raw is not None:
                cpu[str(node)] = float(raw)
    return cpu or None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODE_USAGE_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODE_USAGE-01 节点用量：默认 CPU 降序与百分比换算。"""

    ui = cluster_management_page
    assert ui.api is not None

    with ui.page.expect_response(lambda response: "type=rank" in response.url and "sort_metric=node_cpu_utilisation" in response.url) as captured:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/node-usage")
    assert captured.value.status == 200
    expected_names, values = _rank_rows(captured.value.json(), "node_cpu_utilisation")
    cpu = {name: metrics["node_cpu_utilisation"] for name, metrics in values.items()
           if "node_cpu_utilisation" in metrics}
    if not cpu:
        pytest.skip("本次排行没有返回节点 CPU 指标")
    surface = ui.page.locator('[data-ai-id="node-usage:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    rows = surface.locator("[data-ai-row]")
    assert rows.count() == len(expected_names), f"行数 {rows.count()} 与有效节点数 {len(expected_names)} 不一致"

    shown = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
    assert shown == expected_names
    assert shown[0] == max(cpu, key=cpu.get), f"首行应为 CPU 最高的节点 {max(cpu, key=cpu.get)}，实际 {shown[0]}"

    for name in shown:
        for cell in ("cpu", "memory", "disk"):
            metric = {"cpu": "node_cpu_utilisation", "memory": "node_memory_utilisation", "disk": "node_disk_size_utilisation"}[cell]
            text = ui.page.locator(f'[data-ai-id="node-usage:{metric}:{name}"]').last.inner_text().strip()
            fraction = values.get(name, {}).get(metric)
            if fraction is None:
                assert text == "-", f"{name} 的未知 {cell} 不应填零: {text!r}"
                continue
            match = PERCENT.search(text)
            assert match, f"{name} 的 {cell} 不是百分比: {text!r}"
            percent = int(match.group(1))
            assert 0 <= percent <= 100, f"{name} 的 {cell} 超出 0-100: {percent}"
            # Compare the API fraction, not just a plausible percentage label.
            assert abs(percent - round(fraction * 100)) <= 2

        pods = ui.page.locator(f'[data-ai-id="node-usage:pods:{name}"]').last.inner_text().strip()
        if "node_pod_running_count" in values.get(name, {}):
            assert pods.isdigit(), f"{name} 的容器组数不是整数: {pods!r}"
        else:
            assert pods == "-", f"{name} 的未知容器组数不应填零"

    # ---- US2: switching the sort dimension reorders the list ----
    # Clicking the memory header must sort by memory, and clicking again must flip it.
    # A sort control that ignores the new key is the defect this covers.
    memory_header = surface.locator('[data-ai-id="node-usage:sort:node_memory_utilisation"]')
    for _ in range(2):
        with ui.page.expect_response(lambda response: "type=rank" in response.url and "sort_metric=node_memory_utilisation" in response.url) as changed:
            memory_header.click()
        expected, _ = _rank_rows(changed.value.json(), "node_memory_utilisation")
        expect(surface).to_have_attribute("data-ai-state", "ready")
        assert rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") == expected

    screenshot(ui.page, "cluster-node-usage")
