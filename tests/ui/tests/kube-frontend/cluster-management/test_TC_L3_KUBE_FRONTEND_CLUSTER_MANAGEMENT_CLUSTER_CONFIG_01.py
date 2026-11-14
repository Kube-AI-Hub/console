from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

KAPIS = "/kapis/resources.kubesphere.io/v1alpha3"

#: (route segment, ai-id prefix, expected visible headers, project-page segment)
#: The project page segment is the same as the route segment for all three.
PAGES = (
    ("secrets", "cluster-secrets", ("名称", "项目", "类型", "字段数", "创建时间")),
    ("configmaps", "cluster-configmaps", ("名称", "项目", "字段", "创建时间")),
    ("serviceaccounts", "cluster-serviceaccounts", ("名称", "项目", "保密字典", "创建时间")),
)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_CONFIG_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01 集群级配置三页。"""

    ui = cluster_management_page
    assert ui.api is not None, "api client required"

    for segment, ai_id, expected_headers in PAGES:
        status, body = ui.api.request("GET", f"{KAPIS}/{segment}?limit=20&page=1")
        if status != 200 or not isinstance(body, dict):
            pytest.skip(f"无法读取跨项目 {segment}")
        items = body.get("items") or []
        total = int(body.get("totalItems") or len(items))
        if not items:
            pytest.skip(f"集群没有 {segment}")

        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/{segment}")
        surface = ui.page.locator(f'[data-ai-id="{ai_id}:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        # Cluster-wide collections are the slowest reads in this environment.
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        state = surface.get_attribute("data-ai-state")
        assert state == "ready", f"{segment} 页进入了 {state} 状态"

        headers = [header.strip() for header in surface.locator("thead th:visible").all_inner_texts() if header.strip()]
        for expected in expected_headers:
            assert expected in headers, f"{segment} 表头缺「{expected}」: {headers}"

        rows = surface.locator("tbody tr[data-ai-row]")
        expect(rows).to_have_count(min(20, total), timeout=30_000)

        # Every visible row: the project column is the object's namespace, and the
        # name links into that project's own detail page (workspace + project + kind).
        for index in range(rows.count()):
            row = rows.nth(index)
            handle = row.get_attribute("data-ai-row") or ""
            namespace, _, name = handle.partition("/")
            assert namespace and name, f"{segment} 行句柄应为 项目/名称: {handle!r}"

            project_cell = row.locator("td").nth(1).inner_text().strip()
            assert project_cell == namespace, f"{segment} 项目列应为 {namespace}: {project_cell!r}"

            href = row.locator("a").first.get_attribute("href") or ""
            assert f"/projects/{namespace}/{segment}/{name}" in href, href
            assert href.startswith("/kube-frontend/") and "/clusters/" in href, href

    # The three pages live in the sidebar's 配置 group; the registry entry is what
    # makes them reachable at all.
    sidebar = ui.page.locator("aside").first.inner_text()
    assert "配置" in sidebar, sidebar[:200]

    screenshot(ui.page, "cluster-config")
