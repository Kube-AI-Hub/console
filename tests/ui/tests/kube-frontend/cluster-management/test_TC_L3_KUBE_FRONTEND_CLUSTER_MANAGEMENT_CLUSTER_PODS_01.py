from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/kapis/resources.kubesphere.io/v1alpha3/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_PODS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-01 集群级容器组。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{PODS}?limit=20&page=1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取跨项目容器组")
    items = body.get("items") or []
    total = int(body.get("totalItems") or len(items))
    if not items:
        pytest.skip("集群没有容器组")
    first = items[0]

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/pods")
    surface = ui.page.locator('[data-ai-id="cluster-pods:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    headers = [header.strip() for header in surface.locator("thead th:visible").all_inner_texts() if header.strip()]
    for expected in ("名称", "项目", "状态"):
        assert expected in headers, headers

    rows = surface.locator("tbody tr[data-ai-row]")
    expect(rows).to_have_count(min(20, total), timeout=30_000)

    name = first["metadata"]["name"]
    namespace = first["metadata"]["namespace"]
    row = surface.locator(f'tbody tr[data-ai-row="{name}"]')
    if row.count() == 0:
        pytest.skip(f"{name} 不在当前页")
    text = row.inner_text()
    assert namespace in text, f"项目列应为 {namespace}: {text}"

    link = row.locator("a").first
    href = link.get_attribute("href") or ""
    assert f"/projects/{namespace}/pods/{name}" in href, href
    assert href.startswith("/kube-frontend/") and "/clusters/" in href, href

    screenshot(ui.page, "cluster-pods")
