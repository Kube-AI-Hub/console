from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

JENKINSFILE = "pipeline { agent any; stages { stage('build') { steps { echo 'hello' } } } }"


def _is_disabled(locator) -> bool:
    return locator.is_disabled() or locator.get_attribute("aria-disabled") == "true"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PIPELINES_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02 流水线创建、编辑、复制、删除。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)
    container = devops.pick_container()
    if container is None:
        pytest.skip("集群没有命名空间可用的 DevOps 工程：流水线写用例需要真实工程命名空间")
    project, _namespace = container

    suffix = devops.unique("pwspec-crud")[-8:]
    single = f"pwspec-pipe-{suffix}"
    multi = f"pwspec-mb-{suffix}"
    copied = f"pwspec-copy-{suffix}"
    alias = f"pipe-alias-{suffix}"
    alias_edited = alias + "-v2"
    created: list[str] = []

    try:
        devops.open_project(project)
        devops.open_tab("pipelines")

        # ---- create a single-branch pipeline with an inline Jenkinsfile ----
        devops.click("devops-detail:pipelines-create")
        devops.expect_dialog()
        expect(devops.locator("devops:pipeline-form-name")).to_have_value("")
        assert "单分支流水线" in devops.current_select_text("devops:pipeline-form-type")
        assert "agent any" in devops.locator("devops:pipeline-form-jenkinsfile").input_value()

        devops.click("devops:pipeline-form-submit")
        expect(devops.dialog()).to_contain_text("请输入名称。")

        devops.fill("devops:pipeline-form-name", single)
        devops.fill("devops:pipeline-form-alias", alias)
        devops.fill("devops:pipeline-form-description", "created by the spec case")
        devops.fill("devops:pipeline-form-jenkinsfile", JENKINSFILE)
        devops.click("devops:pipeline-form-submit")
        devops.expect_dialog_closed()
        created.append(single)

        created_single = devops.pipeline(project, single)
        assert created_single["spec"]["type"] == "pipeline", created_single.get("spec")
        assert created_single["spec"]["pipeline"]["jenkinsfile"].strip() == JENKINSFILE.strip()
        assert (created_single["metadata"].get("annotations") or {}).get("kubesphere.io/alias-name") == alias

        # ---- create a multi-branch pipeline from SCM discovery settings ----
        devops.click("devops-detail:pipelines-create")
        devops.expect_dialog()
        devops.select("devops:pipeline-form-type", "多分支流水线")
        expect(devops.locator("devops:pipeline-form-credential")).to_be_visible(timeout=20_000)
        assert "不使用凭证" in devops.current_select_text("devops:pipeline-form-credential")
        devops.fill("devops:pipeline-form-name", multi)
        devops.fill("devops:pipeline-form-repo", f"https://github.com/kube-ai-hub/{suffix}.git")
        devops.fill("devops:pipeline-form-owner", "kube-ai-hub")
        devops.click("devops:pipeline-form-submit")
        devops.expect_dialog_closed()
        created.append(multi)

        created_multi = devops.pipeline(project, multi)
        multi_spec = created_multi["spec"]["multi_branch_pipeline"]
        assert created_multi["spec"]["type"] == "multi-branch-pipeline"
        assert multi_spec["source_type"] == "github"
        assert multi_spec["repo"] if "repo" in multi_spec else multi_spec["github_source"]["repo"]
        assert multi_spec["github_source"]["repo"] == f"https://github.com/kube-ai-hub/{suffix}.git"
        assert multi_spec["github_source"]["credential_id"] == ""
        assert multi_spec["script_path"] == "Jenkinsfile"

        # ---- edit: name and type are read-only, alias/description persist ----
        devops.fill("devops-detail:pipelines-search", single)
        expect(devops.surface(f"devops-detail:pipeline:{single}")).to_be_visible(timeout=60_000)
        devops.click(f"devops-detail:pipeline-edit:{single}")
        devops.expect_dialog()
        assert _is_disabled(devops.locator("devops:pipeline-form-name")), "编辑时名称必须只读"
        assert _is_disabled(devops.locator("devops:pipeline-form-type")), "编辑时类型必须只读"
        devops.fill("devops:pipeline-form-alias", alias_edited)
        devops.click("devops:pipeline-form-submit")
        devops.expect_dialog_closed()
        expect(devops.surface(f"devops-detail:pipeline:{single}")).to_contain_text(alias_edited, timeout=30_000)
        edited = devops.pipeline(project, single)
        assert (edited["metadata"].get("annotations") or {}).get("kubesphere.io/alias-name") == alias_edited
        assert edited["spec"]["pipeline"]["jenkinsfile"].strip() == JENKINSFILE.strip()

        # ---- copy: name empty, type and Jenkinsfile carried from the source ----
        devops.click(f"devops-detail:pipeline-copy:{single}")
        devops.expect_dialog()
        expect(devops.dialog()).to_contain_text("复制流水线")
        expect(devops.locator("devops:pipeline-form-name")).to_have_value("")
        assert "单分支流水线" in devops.current_select_text("devops:pipeline-form-type")
        assert devops.locator("devops:pipeline-form-jenkinsfile").input_value().strip() == JENKINSFILE.strip()
        devops.fill("devops:pipeline-form-name", copied)
        devops.click("devops:pipeline-form-submit")
        devops.expect_dialog_closed()
        created.append(copied)
        copied_object = devops.pipeline(project, copied)
        assert copied_object["spec"]["pipeline"]["jenkinsfile"].strip() == JENKINSFILE.strip()

        # ---- delete the copy and both originals through the typed-name dialog ----
        devops.fill("devops-detail:pipelines-search", copied)
        expect(devops.surface(f"devops-detail:pipeline:{copied}")).to_be_visible(timeout=60_000)
        devops.delete_via_dialog(f"devops-detail:pipeline-delete:{copied}", "devops-detail", copied)
        expect(ui.page.locator(f'[data-ai-id="devops-detail:pipeline:{copied}"]')).to_have_count(0, timeout=60_000)
        created.remove(copied)

        for name in (single, multi):
            devops.fill("devops-detail:pipelines-search", name)
            expect(devops.surface(f"devops-detail:pipeline:{name}")).to_be_visible(timeout=60_000)
            devops.delete_via_dialog(f"devops-detail:pipeline-delete:{name}", "devops-detail", name)
            expect(ui.page.locator(f'[data-ai-id="devops-detail:pipeline:{name}"]')).to_have_count(0, timeout=60_000)
            created.remove(name)

        screenshot(ui.page, "devops-pipelines-crud")
    finally:
        for name in created:
            devops.delete_pipeline_quiet(project, name)
