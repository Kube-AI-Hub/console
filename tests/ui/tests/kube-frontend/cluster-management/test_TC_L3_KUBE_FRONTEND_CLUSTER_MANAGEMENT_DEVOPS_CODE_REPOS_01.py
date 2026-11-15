from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_CODE_REPOS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_CODE_REPOS-01 代码仓库导入、列表与删除。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)
    container = devops.pick_container()
    if container is None:
        pytest.skip("集群没有命名空间可用的 DevOps 工程：代码仓库页签需要真实工程命名空间")
    project, namespace = container

    name = devops.unique("pwspec-repo")
    url = f"https://github.com/kube-ai-hub/{name}.git"
    created = True

    def row():
        return ui.page.locator(f'[data-ai-id="devops-detail:code-repo-table"] tbody tr[data-ai-row="{name}"]')

    try:
        devops.open_project(project)
        devops.open_tab("code-repo")
        devops.expect_exactly_one_state("code-repo")
        table = devops.surface("devops-detail:code-repo-table")
        if table.count() > 0:
            headers = [title.strip() for title in table.locator("thead th").all_inner_texts()]
            assert headers == ["名称", "提供方", "仓库地址", "访问凭证", "更多操作"], headers

        devops.click("devops-detail:coderepo-create")
        devops.expect_dialog()
        devops.click("devops:coderepo-form-submit")
        expect(devops.dialog()).to_contain_text("请输入名称。")

        devops.fill("devops:coderepo-form-name", name)
        devops.fill("devops:coderepo-form-url", url)
        devops.click("devops:coderepo-form-submit")
        devops.expect_dialog_closed()
        expect(row()).to_be_visible(timeout=60_000)
        text = row().inner_text()
        # The provider cell renders spec.provider verbatim (the legacy table title-cased it).
        assert "github" in text, text
        assert url in text, text

        repositories = devops.code_repositories(namespace)
        imported = [item for item in repositories if (item.get("metadata") or {}).get("name") == name]
        assert len(imported) == 1
        spec = imported[0].get("spec") or {}
        assert spec.get("provider") == "github"
        assert spec.get("url") == url

        devops.delete_via_dialog(f"devops-detail:coderepo-delete:{name}", "devops-detail", name)
        expect(row()).to_have_count(0, timeout=60_000)
        assert all((item.get("metadata") or {}).get("name") != name for item in devops.code_repositories(namespace))
        created = False

        screenshot(ui.page, "devops-code-repos")
    finally:
        if created:
            devops.delete_code_repository_quiet(namespace, name)
