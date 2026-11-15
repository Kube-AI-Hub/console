from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

TAB_ORDER = (
    ("base-info", "基本信息"),
    ("pipelines", "流水线"),
    ("cd", "持续部署"),
    ("code-repo", "代码仓库"),
    ("members", "成员"),
    ("roles", "角色"),
    ("credentials", "凭证"),
)
COLLECTION_TABS = ("pipelines", "cd", "code-repo", "members", "roles", "credentials")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_05(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-05 详情七页签、基本信息、角色与 CD。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)

    projects = devops.projects()
    if not projects:
        pytest.skip("集群没有可用的 DevOps 工程：七页签与角色/ CD 需要真实工程")
    project = projects[0]
    name = str((project.get("metadata") or {}).get("name") or "")
    namespace = devops.namespace_of(project)
    assert name and namespace
    roles = devops.roles(name)
    members = devops.members(name)

    devops.open_project(name)

    # ---- default tab and basic information ----
    expect(devops.tab("base-info")).to_have_attribute("aria-selected", "true")
    expect(devops.surface("devops-detail:basic")).to_be_visible(timeout=60_000)
    expect(devops.surface("devops-detail:name")).to_have_text(name, timeout=30_000)
    expect(devops.surface("devops-detail:namespace")).to_have_text(namespace)
    for handle in ("alias", "workspace", "creator", "created-at", "sync-status", "placement", "description-row"):
        expect(devops.surface(f"devops-detail:{handle}")).to_be_visible(timeout=30_000)
    expect(devops.surface("devops-detail:member-count")).to_have_text(str(len(members)), timeout=60_000)
    expect(devops.surface("devops-detail:role-count")).to_have_text(str(len(roles)), timeout=60_000)

    # ---- CD allow-list block is part of base information ----
    expect(devops.surface("devops-detail:allowlist")).to_be_visible()
    expect(devops.surface("devops-detail:allowlist-repos")).not_to_have_text("")
    expect(devops.surface("devops-detail:allowlist-destinations")).not_to_have_text("")

    # ---- tab order ----
    for tab, label in TAB_ORDER:
        text = devops.tab_text(tab)
        assert text.splitlines()[0].strip() == label, f"{tab} 页签文案应为 {label}，实际 {text!r}"

    # ---- every collection tab renders exactly one state ----
    for tab in COLLECTION_TABS:
        devops.open_tab(tab)
        if tab == "pipelines":
            expect(devops.surface("devops-detail:pipelines")).to_be_visible(timeout=20_000)
        else:
            expect(devops.surface(f"devops-detail:{tab}-panel")).to_be_visible(timeout=20_000)
        devops.expect_exactly_one_state(tab)

    # ---- roles: preset roles, templates and count badge ----
    devops.open_tab("roles")
    roles_table = devops.surface("devops-detail:roles-table")
    expect(roles_table).to_be_visible(timeout=60_000)
    headers = [title.strip() for title in roles_table.locator("thead th").all_inner_texts()]
    assert headers == ["名称", "别名", "权限模块", "角色类型", "创建时间"], headers
    expect(devops.collection_rows("roles")).to_have_count(len(roles), timeout=30_000)
    roles_text = roles_table.inner_text()
    for preset in ("viewer", "operator", "admin"):
        assert preset in roles_text, f"角色表缺少预置角色 {preset}"
    assert "预置角色" in roles_text
    assert "权限模板" in roles_text
    assert str(len(roles)) in devops.tab_text("roles")

    # ---- CD tab: column set, and empty state when there is no application ----
    devops.open_tab("cd")
    cd_table = devops.surface("devops-detail:cd-table")
    if cd_table.count() > 0:
        headers = [title.strip() for title in cd_table.locator("thead th").all_inner_texts()]
        assert headers == ["名称", "健康状态", "同步状态", "目标命名空间"], headers
    else:
        expect(devops.surface("devops-detail:cd-empty")).to_contain_text("该工程还没有持续部署")

    # ---- missing project: not-found; the tab strip is not rendered ----
    missing = devops.unique("tc-e2e-missing-devops")
    devops.open_project(missing)
    expect(devops.surface("devops-detail:not-found")).to_be_visible(timeout=60_000)
    assert ui.page.locator('[data-ai-id="devops-detail:tab:base-info"]').count() == 0

    screenshot(ui.page, "devops-detail-tabs")
