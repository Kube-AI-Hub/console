from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PVCS = "/kapis/resources.kubesphere.io/v1alpha3/persistentvolumeclaims"
EXPECTED_HEADERS = ("名称", "项目", "状态", "容量", "访问模式", "存储类型", "创建时间")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_PVC_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01 集群级存储卷声明。"""

    ui = cluster_management_page
    assert ui.api is not None, "api client required"

    status, body = ui.api.request("GET", f"{PVCS}?limit=20&page=1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取跨项目存储卷声明")
    items = body.get("items") or []
    total = int(body.get("totalItems") or len(items))
    if not items:
        pytest.skip("集群没有存储卷声明")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/persistentvolumeclaims")
    surface = ui.page.locator('[data-ai-id="cluster-pvc:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    # Cluster-wide collections are the slowest reads in this environment.
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    state = surface.get_attribute("data-ai-state")
    assert state == "ready", f"存储卷页进入了 {state} 状态"

    headers = [header.strip() for header in surface.locator("thead th").all_inner_texts() if header.strip()]
    for expected in EXPECTED_HEADERS:
        assert expected in headers, f"表头缺「{expected}」: {headers}"

    rows = surface.locator("tbody tr[data-ai-row]")
    expect(rows).to_have_count(min(20, total), timeout=30_000)

    # Every row: the project column is the object's namespace, and the name links
    # into that project's own claim detail page.
    for index in range(rows.count()):
        row = rows.nth(index)
        handle = row.get_attribute("data-ai-row") or ""
        namespace, _, name = handle.partition("/")
        assert namespace and name, f"行句柄应为 项目/名称: {handle!r}"

        project_cell = row.locator("td").nth(1).inner_text().strip()
        assert project_cell == namespace, f"项目列应为 {namespace}: {project_cell!r}"

        href = row.locator("a").first.get_attribute("href") or ""
        assert f"/projects/{namespace}/persistentvolumeclaims/{name}" in href, href
        assert href.startswith("/kube-frontend/") and "/clusters/" in href, href

    screenshot(ui.page, "cluster-pvc")

    # Search is a server-side keyword: the request has to carry the name, and the
    # result has to keep the matching row (not just filter the current page).
    first = items[0]["metadata"]
    unique = first["name"]
    search = surface.locator('[data-ai-id="cluster-pvc:search"]').first
    with ui.page.expect_request(
        lambda request: "persistentvolumeclaims" in request.url and "name=" in request.url,
        timeout=60_000,
    ) as keyword_request:
        search.fill(unique)
    assert f"name={unique}" in keyword_request.value.url, keyword_request.value.url
    expect(ui.page.locator(f'tbody tr[data-ai-row="{first["namespace"]}/{unique}"]')).to_be_visible(timeout=60_000)
