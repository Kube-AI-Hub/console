from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
NAMESPACES = "/kapis/resources.kubesphere.io/v1alpha3/namespaces"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_DETAIL_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_DETAIL-01 企业空间详情。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{WORKSPACES}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取企业空间列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("平台没有企业空间")

    name = items[0]["metadata"]["name"]
    status, ws = ui.api.request("GET", f"{WORKSPACES}/{name}")
    if status != 200 or not isinstance(ws, dict):
        pytest.skip("无法读取企业空间对象")

    manager = (((ws.get("spec") or {}).get("template") or {}).get("spec") or {}).get("manager") or ""
    creator = ((ws.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/creator") or ""

    status, ns = ui.api.request("GET", f"{NAMESPACES}?labelSelector=kubesphere.io/workspace={name}&limit=-1")
    projects = (ns.get("items") or []) if status == 200 and isinstance(ns, dict) else []

    ui.page.goto(f"{ui.base_url}/kube-frontend/access/workspaces")
    surface = ui.page.locator('[data-ai-id="workspaces:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    link = surface.locator(f'[data-ai-row="{name}"] a').first
    expect(link).to_have_attribute("href", f"/kube-frontend/access/workspaces/{name}")
    link.click()

    detail = ui.page.locator('[data-ai-id="workspace-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert f"/access/workspaces/{name}" in ui.page.url, ui.page.url

    basic = ui.page.locator('[data-ai-id="workspace-detail:basic"]').inner_text()
    if manager:
        assert str(manager) in basic, f"管理员应为 {manager}: {basic[:200]}"
    if creator:
        assert str(creator) in basic, f"创建者应为 {creator}: {basic[:200]}"

    # Project count must equal the namespaces carrying the workspace label — the label is the
    # only thing that ties a project to a workspace.
    block = ui.page.locator('[data-ai-id="workspace-detail:projects"]')
    expect(block).to_contain_text(f"({len(projects)})", timeout=30_000)
    rows = ui.page.locator('[data-ai-id="workspace-detail:project-list"] [data-ai-row]')
    assert rows.count() == len(projects), f"项目行数 {rows.count()} 与标签命名空间数 {len(projects)} 不一致"

    if projects:
        first = projects[0]["metadata"]["name"]
        project_link = ui.page.locator(f'[data-ai-id="workspace-detail:project-list"] [data-ai-row="{first}"] a').first
        href = project_link.get_attribute("href") or ""
        # The project console URL carries the workspace segment: /kube-frontend/<ws>/clusters/<c>/projects/<ns>/…
        assert href.startswith(f"/kube-frontend/{name}/clusters/") and f"/projects/{first}/" in href, href
        project_link.click()
        expect(ui.page.locator('[data-ai-id="configmaps:surface"]').last).to_be_visible(timeout=30_000)
        assert f"/projects/{first}/" in ui.page.url, ui.page.url

    screenshot(ui.page, "workspace-detail")
