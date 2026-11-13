from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

KAPIS = "/kapis/resources.kubesphere.io/v1alpha3"


def _workspace_projects(ui, cluster: str) -> dict[str, set[str]]:
    """Namespace name → owning workspace, read from the cluster's own list."""
    status, body = ui.api.request("GET", f"{KAPIS}/namespaces?page=1&limit=500")
    assert status == 200, status
    mapping: dict[str, set[str]] = {}
    for item in body.get("items") or []:
        metadata = item.get("metadata") or {}
        name = metadata.get("name") or ""
        workspace = (metadata.get("labels") or {}).get("kubesphere.io/workspace") or ""
        if name and workspace:
            mapping.setdefault(workspace, set()).add(name)
    return mapping


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_WORKBENCH_CONTEXT_01(page, ui_config, workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01 项目上下文栏：企业空间 / 集群 / 项目三级，项目不跨租户。"""

    ui = workbench_page
    assert ui.api is not None
    cluster = ui_config.cluster

    by_workspace = _workspace_projects(ui, cluster)
    # Need two enterprise spaces, one of which owns no project on this cluster, to prove the
    # picker does not offer another tenant's projects.
    if len(by_workspace) < 2:
        pytest.skip(f"集群上不足两个企业空间，无法验证跨租户过滤: {list(by_workspace)}")

    workspace = sorted(by_workspace)[0]
    project = sorted(by_workspace[workspace])[0]
    other_workspace = sorted(by_workspace)[1]
    other_projects = sorted(by_workspace[other_workspace])

    page.goto(f"{ui.base_url}/kube-frontend/{workspace}/clusters/{cluster}/projects/{project}/configmaps")
    bar = page.locator('[data-ai-id="workspace-bar"]')
    expect(bar).to_be_visible(timeout=30_000)

    # The three scopes are named on the bar: a project is only meaningful together with the
    # cluster it runs on and the enterprise space that governs it.
    expect(page.locator('[data-ai-id="workspace:current-workspace"]')).to_contain_text(workspace)
    expect(page.locator('[data-ai-id="workspace:cluster-select"]')).to_be_visible()
    expect(page.locator('[data-ai-id="workspace:project-select"]')).to_be_visible()

    # The project picker lists this enterprise space's projects only.
    page.locator('[data-ai-id="workspace:project-select"]').first.click()
    expect(page.get_by_role("option").first).to_be_visible(timeout=15_000)
    options = [text.strip() for text in page.get_by_role("option").all_inner_texts()]
    page.keyboard.press("Escape")

    assert project in options, (project, options[:10])
    for foreign in other_projects[:5]:
        assert foreign not in options, f"{foreign} 属于 {other_workspace}，不该出现在 {workspace} 的项目下拉里"
    screenshot(page, "project-context")
