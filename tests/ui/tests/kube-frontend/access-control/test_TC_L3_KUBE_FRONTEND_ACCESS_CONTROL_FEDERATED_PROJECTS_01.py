from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

FEDERATED = "/apis/types.kubefed.io/v1beta1"
NAMESPACES = FEDERATED + "/federatednamespaces"
WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces?limit=-1"
LIST_SURFACE = '[data-ai-id="federated-projects:surface"]'
DETAIL_SURFACE = '[data-ai-id="federated-project:surface"]'
HEADERS = ("名称", "命名空间", "部署集群", "创建时间")


def _workspace_of(item: dict) -> str:
    template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
    labels = (item.get("metadata") or {}).get("labels") or {}
    return template.get("kubesphere.io/workspace") or labels.get("kubesphere.io/workspace") or ""


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-01 联邦项目列表与详情骨架。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", NAMESPACES)
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取联邦项目（federatednamespaces）")
    projects = [item for item in (body.get("items") or []) if (item.get("metadata") or {}).get("name")]
    if not projects:
        pytest.skip("集群没有 FederatedNamespace，无法核对列表")

    workspace = _workspace_of(projects[0])
    if not workspace:
        pytest.skip("FederatedNamespace 没有 workspace 标签，无法核对企业空间过滤")
    expected = sorted(
        (item.get("metadata") or {}).get("name")
        for item in projects
        if _workspace_of(item) == workspace
    )
    project = next(item for item in projects if (item.get("metadata") or {}).get("name") == expected[0])

    status, discovery = ui.api.request("GET", FEDERATED)
    assert status == 200, (status, discovery)
    types = [
        resource
        for resource in discovery.get("resources") or []
        if resource.get("namespaced") is True and "/" not in str(resource.get("name") or "")
    ]
    assert types, "联邦 API discovery 没有命名空间级资源类型"

    ui.page.goto(f"{ui.base_url}/kube-frontend/workspaces/{workspace}/federatedprojects")
    surface = ui.page.locator(LIST_SURFACE).last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
    for expected_header in HEADERS:
        assert expected_header in headers, (expected_header, headers)

    rows = surface.locator("tbody tr[data-ai-row]")
    expect(rows).to_have_count(len(expected), timeout=60_000)
    handles = sorted(rows.evaluate_all("els => els.map((el) => el.getAttribute('data-ai-row'))"))
    assert handles == expected, (handles, expected)

    # The name link is the way in; the detail must render from the same read.
    name = expected[0]
    ui.page.locator(f'[data-ai-id="federated-projects:open:{name}"]').first.click()
    detail = ui.page.locator(DETAIL_SURFACE).last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    assert f"/federatedprojects/{name}" in ui.page.url, ui.page.url

    basic = ui.page.locator('[data-ai-id="federated-project:basic"]').inner_text()
    metadata = project.get("metadata") or {}
    assert name in basic, basic
    assert metadata.get("namespace") or name in basic, basic
    assert workspace in basic, basic

    type_rows = ui.page.locator('[data-ai-id="federated-project:types"] tbody tr[data-ai-row]')
    expect(type_rows).to_have_count(len(types), timeout=60_000)
    type_headers = [
        text.strip()
        for text in ui.page.locator('[data-ai-id="federated-project:types"] thead th').all_inner_texts()
        if text.strip()
    ]
    assert type_headers == ["类型", "资源"], type_headers
    expect(ui.page.locator('[data-ai-id="federated-project:back"]')).to_be_visible()

    # Empty state: a workspace with no federated projects must say so, not show an empty table.
    status, workspaces_body = ui.api.request("GET", WORKSPACES)
    empty_workspace = None
    if status == 200 and isinstance(workspaces_body, dict):
        known = {
            (item.get("metadata") or {}).get("name")
            for item in workspaces_body.get("items") or []
        }
        for candidate in sorted(known - {workspace}):
            if not any(_workspace_of(item) == candidate for item in projects):
                empty_workspace = candidate
                break
    if empty_workspace:
        ui.page.goto(f"{ui.base_url}/kube-frontend/workspaces/{empty_workspace}/federatedprojects")
        empty_surface = ui.page.locator(LIST_SURFACE).last
        expect(empty_surface).to_be_visible(timeout=30_000)
        expect(empty_surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        expect(empty_surface).to_have_attribute("data-ai-state", "empty")
        expect(empty_surface).to_contain_text("暂无联邦项目")

    screenshot(ui.page, "federated-projects")
