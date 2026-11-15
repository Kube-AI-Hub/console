from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

JENKINSFILE_ONE = "pipeline { agent any; stages { stage('one') { steps { echo 'one' } } } }"
JENKINSFILE_TWO = "pipeline { agent any; stages { stage('two') { steps { echo 'two' } } } }"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PIPELINES_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03 流水线详情：基本信息与 Jenkinsfile 保存。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)
    container = devops.pick_container()
    if container is None:
        pytest.skip("集群没有命名空间可用的 DevOps 工程：流水线详情需要真实工程命名空间")
    project, namespace = container

    suffix = devops.unique("pwspec-detail")[-8:]
    single = f"pwspec-detail-{suffix}"
    multi = f"pwspec-detail-mb-{suffix}"
    description = "pipeline detail spec"
    created: list[str] = []

    try:
        devops.create_pipeline(project, single, jenkinsfile=JENKINSFILE_ONE, description=description)
        created.append(single)
        devops.create_pipeline(project, multi, kind="multi-branch-pipeline", repo=f"https://github.com/kube-ai-hub/{suffix}.git")
        created.append(multi)

        devops.open_pipeline(project, single)
        expect(devops.surface("pipeline-detail:basic")).to_be_visible(timeout=60_000)
        expect(devops.surface("pipeline-detail:name")).to_have_text(single)
        expect(devops.surface("pipeline-detail:type")).to_have_text("单分支流水线")
        expect(devops.surface("pipeline-detail:namespace")).to_have_text(namespace)
        expect(devops.surface("pipeline-detail:description")).to_have_text(description)
        # No Jenkins metadata on this installation: sync/validate are '-', health is 无状态.
        expect(devops.surface("pipeline-detail:sync-status")).to_have_text("-")
        expect(devops.surface("pipeline-detail:health")).to_have_text("无状态")
        expect(devops.surface("pipeline-detail:validate")).to_have_text("-")

        # ---- config tab: dirty-only save, cancel restores, save persists and reads back ----
        devops.open_pipeline_tab("config")
        editor = devops.surface("pipeline-detail:config-editor")
        expect(editor).to_be_visible(timeout=30_000)
        assert editor.input_value().strip() == JENKINSFILE_ONE.strip()
        save = devops.surface("pipeline-detail:config-save")
        expect(save).to_be_disabled()

        editor.fill(JENKINSFILE_TWO)
        expect(save).to_be_enabled()
        devops.click("pipeline-detail:config-reset")
        expect(editor).to_have_value(JENKINSFILE_ONE.strip(), timeout=20_000)

        editor.fill(JENKINSFILE_TWO)
        devops.click("pipeline-detail:config-save")
        # Saving clears the draft (button disabled again) and re-reads the pipeline.
        expect(save).to_be_disabled(timeout=60_000)
        persisted = devops.pipeline(project, single)
        assert persisted["spec"]["pipeline"]["jenkinsfile"].strip() == JENKINSFILE_TWO.strip()
        ui.page.reload(wait_until="domcontentloaded")
        expect(devops.surface("pipeline-detail:surface")).to_be_visible(timeout=60_000)
        devops.open_pipeline_tab("config")
        expect(devops.surface("pipeline-detail:config-editor")).to_have_value(JENKINSFILE_TWO.strip(), timeout=30_000)

        # ---- multi-branch: script path is read-only, no editor ----
        devops.open_pipeline(project, multi)
        expect(devops.surface("pipeline-detail:type")).to_have_text("多分支流水线")
        devops.open_pipeline_tab("config")
        expect(devops.surface("pipeline-detail:config-multibranch")).to_be_visible(timeout=30_000)
        assert ui.page.locator('[data-ai-id="pipeline-detail:config-editor"]').count() == 0

        screenshot(ui.page, "devops-pipeline-config")
    finally:
        for name in created:
            devops.delete_pipeline_quiet(project, name)
