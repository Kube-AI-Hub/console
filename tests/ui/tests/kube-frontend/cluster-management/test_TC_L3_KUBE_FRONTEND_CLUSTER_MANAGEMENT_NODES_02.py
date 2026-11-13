from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

METRICS = "/apis/metrics.k8s.io/v1beta1/nodes"
NODES = "/api/v1/nodes"


def _quantity(value: str) -> float:
    units = {'': 1, 'n': 1e-9, 'u': 1e-6, 'm': 1e-3, 'k': 1e3, 'M': 1e6, 'G': 1e9,
             'Ki': 1024, 'Mi': 1024 ** 2, 'Gi': 1024 ** 3, 'Ti': 1024 ** 4}
    for suffix in sorted(units, key=len, reverse=True):
        if suffix and value.endswith(suffix):
            return float(value[: -len(suffix)]) * units[suffix]
    return float(value)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02 节点列表：CPU 与内存使用率。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, metrics = ui.api.request("GET", METRICS)
    if status != 200:
        pytest.skip("metrics.k8s.io 不可用，使用率列降级为 -")
    status, nodes = ui.api.request("GET", NODES)
    if status != 200:
        pytest.skip("无法读取节点")

    usage = {item["metadata"]["name"]: item.get("usage", {}) for item in (metrics.get("items") or [])}
    capacity = {
        item["metadata"]["name"]: (item.get("status") or {}).get("allocatable", {}) for item in (nodes.get("items") or [])
    }

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes")
    surface = ui.page.locator('[data-ai-id="nodes:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    headers = [t.strip() for t in surface.locator("thead th:visible").all_inner_texts()]
    assert "CPU 使用率" in headers, headers
    assert "内存使用率" in headers, headers

    checked = 0
    for name, used in usage.items():
        row = surface.locator(f'[data-ai-row="{name}"]')
        if row.count() == 0:
            continue
        text = row.inner_text()
        cpu_capacity = capacity.get(name, {}).get("cpu")
        if used.get("cpu") and cpu_capacity:
            expected = round(_quantity(used["cpu"]) / _quantity(cpu_capacity) * 100)
            assert f"{expected}%" in text, (name, expected, text)
            checked += 1
    assert checked > 0, "no node row carried a CPU percentage"

    # A percentage outside 0–100 means the unit conversion dropped a suffix (n vs m).
    for cell in surface.locator("tbody tr").all():
        for value in cell.inner_text().split():
            if value.endswith("%"):
                assert 0 <= int(value.rstrip("%")) <= 100, value
    screenshot(ui.page, "cluster-node-usage")
