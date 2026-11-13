from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NODE_METRICS = "/kapis/monitoring.kubesphere.io/v1alpha3/nodes"
PERCENT = re.compile(r"^(\d+)%$")


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

    cpu = _node_usage(ui.api)
    if cpu is None:
        pytest.skip("监控后端没有返回节点 CPU 指标")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/node-usage")
    surface = ui.page.locator('[data-ai-id="node-usage:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    rows = surface.locator("[data-ai-row]")
    assert rows.count() == len(cpu), f"行数 {rows.count()} 与节点数 {len(cpu)} 不一致（是否漏了 limit=-1）"

    shown = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
    assert shown[0] == max(cpu, key=cpu.get), f"首行应为 CPU 最高的节点 {max(cpu, key=cpu.get)}，实际 {shown[0]}"

    for name in shown:
        for cell in ("cpu", "memory", "disk"):
            text = ui.page.locator(f'[data-ai-id="node-usage:{cell}:{name}"]').last.inner_text().strip()
            match = PERCENT.search(text)
            assert match, f"{name} 的 {cell} 不是百分比: {text!r}"
            percent = int(match.group(1))
            assert 0 <= percent <= 100, f"{name} 的 {cell} 超出 0-100: {percent}"

        # The conversion is the point: compare against the API's own fraction, so a page
        # that prints 0.06% for a node at 6% fails here rather than looking plausible.
        expected = round(cpu[name] * 100)
        actual = int(PERCENT.search(ui.page.locator(f'[data-ai-id="node-usage:cpu:{name}"]').last.inner_text().strip()).group(1))
        assert abs(actual - expected) <= 2, f"{name} CPU 显示 {actual}%，接口比例 {cpu[name]} 换算应为 {expected}%"

        pods = ui.page.locator(f'[data-ai-id="node-usage:pods:{name}"]').last.inner_text().strip()
        assert pods.isdigit(), f"{name} 的容器组数不是整数: {pods!r}"

    screenshot(ui.page, "cluster-node-usage")
