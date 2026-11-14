from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
MEMBERS = "/kapis/iam.kubesphere.io/v1alpha2/workspaces/{ws}/workspacemembers"
NAMESPACES = "/kapis/resources.kubesphere.io/v1alpha3/namespaces"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01 企业空间控制台。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{WORKSPACES}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取企业空间")
    workspaces = [(item.get("metadata") or {}).get("name") for item in (body.get("items") or [])]
    workspace = next((name for name in workspaces if name), None)
    if workspace is None:
        pytest.skip("没有可用的企业空间")

    status, members_body = ui.api.request("GET", MEMBERS.format(ws=workspace))
    members = (members_body.get("items") or []) if status == 200 and isinstance(members_body, dict) else []
    status, projects_body = ui.api.request("GET", f"{NAMESPACES}?labelSelector=kubesphere.io/workspace%3D{workspace}&limit=-1")
    projects = (projects_body.get("items") or []) if status == 200 and isinstance(projects_body, dict) else []

    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/overview")
    surface = ui.page.locator('[data-ai-id="workspace-overview:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    expect(ui.page.locator('[data-ai-id="workspace-overview:title"]')).to_be_visible(timeout=20_000)
    expect(ui.page.locator('[data-ai-id="workspace-overview:project-count"]')).to_have_text(str(len(projects)), timeout=30_000)
    expect(ui.page.locator('[data-ai-id="workspace-overview:member-count"]')).to_have_text(str(len(members)), timeout=30_000)

    sidebar = ui.page.locator("aside").first.inner_text()
    for entry in ("概览", "项目", "租户(企业空间)成员"):
        assert entry in sidebar, sidebar[:300]

    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/projects")
    project_rows = ui.page.locator('[data-ai-id="workspace-projects:surface"] tbody tr[data-ai-row]')
    expect(project_rows).to_have_count(len(projects), timeout=60_000)

    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/members")
    member_rows = ui.page.locator('[data-ai-id="workspace-members:surface"] tbody tr[data-ai-row]')
    expect(member_rows).to_have_count(len(members), timeout=60_000)

    screenshot(ui.page, "workspace-console")
