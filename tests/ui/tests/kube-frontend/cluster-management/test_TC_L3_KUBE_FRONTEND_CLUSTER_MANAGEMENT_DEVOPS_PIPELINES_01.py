from __future__ import annotations

import json

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui


def _health_label(item: dict) -> str:
    """The page's banding of the Jenkins metadata annotation (missing -> 无状态)."""
    annotations = (item.get("metadata") or {}).get("annotations") or {}
    raw = annotations.get("pipeline.devops.kubesphere.io/jenkins-metadata")
    if not raw:
        return "无状态"
    try:
        meta = json.loads(raw)
    except ValueError:
        return "无状态"
    score = meta.get("weatherScore")
    if not isinstance(score, (int, float)):
        return "无状态"
    if score <= 30:
        return "异常"
    if score <= 80:
        return "亚健康"
    return "健康"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PIPELINES_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-01 流水线列表：列、健康、服务端分页、搜索与类型筛选。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)
    container = devops.pick_container()
    if container is None:
        pytest.skip("集群没有命名空间可用的 DevOps 工程：流水线列表需要真实工程命名空间")
    project, namespace = container

    suffix = devops.unique("pwspec-list")[-8:]
    names = [f"pwspec-list-{suffix}-{index:02d}" for index in range(1, 12)]
    multi_name = f"pwspec-list-{suffix}-mb"
    created: list[str] = []

    try:
        for name in names:
            devops.create_pipeline(project, name, jenkinsfile="pipeline { agent any }")
            created.append(name)
        devops.create_pipeline(project, multi_name, kind="multi-branch-pipeline", repo="https://github.com/kube-ai-hub/list.git")
        created.append(multi_name)

        requests: list[str] = []
        ui.page.on("request", lambda request: requests.append(request.url))

        devops.open_project(project)
        devops.open_tab("pipelines")

        items, total = devops.pipelines(project, page=1, limit=10)
        expect(devops.surface("devops-detail:pipelines-total")).to_have_text(f"共 {total} 条", timeout=60_000)
        table = devops.surface("devops-detail:pipelines-table")
        expect(table).to_be_visible(timeout=60_000)
        headers = [title.strip() for title in table.locator("thead th").all_inner_texts()]
        assert headers == ["名称", "健康状态", "类型", "分支数", "合并请求数", "更多操作"], headers

        # ---- the first page mirrors the API rows: health band, type, branch/PR ----
        rows = table.locator("tbody tr[data-ai-row]")
        expect(rows).to_have_count(min(10, total), timeout=30_000)
        by_name = {str((item.get("metadata") or {}).get("name")): item for item in items}
        for index in range(rows.count()):
            row = rows.nth(index)
            row_name = str(row.get_attribute("data-ai-row") or "")
            item = by_name.get(row_name)
            assert item is not None, f"{row_name} 不在接口第一页里"
            spec = item.get("spec") or {}
            kind = "multi-branch-pipeline" if spec.get("type") == "multi-branch-pipeline" else "pipeline"
            cells = [cell.strip() for cell in row.locator("td").all_inner_texts()]
            assert cells[2] == ("多分支流水线" if kind == "multi-branch-pipeline" else "单分支流水线"), cells
            assert cells[3] == "-", cells
            assert cells[4] == "-", cells
            expect(ui.page.locator(f'[data-ai-id="devops-detail:pipeline-health:{row_name}"]')).to_have_text(
                _health_label(item)
            )
            for action in ("run", "edit", "copy", "delete"):
                assert ui.page.locator(f'[data-ai-id="devops-detail:pipeline-{action}:{row_name}"]').count() == 1, action
            link = ui.page.locator(f'[data-ai-id="devops-detail:pipeline:{row_name}"]').last
            expect(link).to_have_attribute(
                "href", f"/kube-frontend/clusters/{ui.cluster}/devops/{project}/pipelines/{row_name}"
            )

        # ---- page size 20/50 and paging ----
        devops.select("devops-detail:pipelines-page-size", "20")
        expect(devops.surface("devops-detail:pipelines-total")).to_have_text(f"共 {total} 条", timeout=60_000)
        expect(devops.surface("devops-detail:pipelines-page")).to_have_text("1 / 1")
        devops.select("devops-detail:pipelines-page-size", "50")
        expect(devops.surface("devops-detail:pipelines-page")).to_have_text("1 / 1")
        devops.select("devops-detail:pipelines-page-size", "10")
        page_count = max(1, (total + 9) // 10)
        expect(devops.surface("devops-detail:pipelines-page")).to_have_text(f"1 / {page_count}")
        if page_count > 1:
            expect(devops.surface("devops-detail:pipelines-prev")).to_be_disabled()
            devops.click("devops-detail:pipelines-next")
            expect(devops.surface("devops-detail:pipelines-page")).to_have_text(f"2 / {page_count}")
            expect(table.locator("tbody tr[data-ai-row]")).to_have_count(total - 10)
            devops.click("devops-detail:pipelines-prev")
            expect(devops.surface("devops-detail:pipelines-page")).to_have_text(f"1 / {page_count}")

        # ---- name search: request carries name, results all match the prefix ----
        requests.clear()
        search_value = f"pwspec-list-{suffix}"
        devops.fill("devops-detail:pipelines-search", search_value)
        search_items, search_total = devops.pipelines(project, page=1, limit=10, name=search_value)
        expect(devops.surface("devops-detail:pipelines-total")).to_have_text(f"共 {search_total} 条", timeout=60_000)
        assert search_total == len(created), search_total
        expect(table.locator("tbody tr[data-ai-row]")).to_have_count(min(10, search_total))
        assert any("name=" + search_value in url for url in requests), requests[-5:]

        # ---- type filter: request carries type, only that kind remains ----
        requests.clear()
        devops.select("devops-detail:pipelines-type", "多分支流水线")
        _, kind_total = devops.pipelines(project, page=1, limit=10, type="multi-branch-pipeline")
        expect(devops.surface("devops-detail:pipelines-total")).to_have_text(f"共 {kind_total} 条", timeout=60_000)
        assert kind_total >= 1
        expect(table.locator("tbody tr[data-ai-row]")).to_have_count(min(10, kind_total))
        assert any("type=multi-branch-pipeline" in url for url in requests), requests[-5:]

        # ---- back to all types and empty search ----
        requests.clear()
        devops.select("devops-detail:pipelines-type", "全部类型")
        devops.fill("devops-detail:pipelines-search", "")
        expect(devops.surface("devops-detail:pipelines-total")).to_have_text(f"共 {total} 条", timeout=60_000)
        assert all("type=" not in url for url in requests if "/pipelines" in url), requests[-5:]

        screenshot(ui.page, "devops-pipelines-list")
    finally:
        for name in created:
            devops.delete_pipeline_quiet(project, name)
