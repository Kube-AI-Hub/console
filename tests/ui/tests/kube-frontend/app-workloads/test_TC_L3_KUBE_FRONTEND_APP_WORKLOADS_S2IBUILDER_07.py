from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

S2I = "/apis/devops.kubesphere.io/v1alpha1"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_07(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-07 构建记录：未知状态如实显示，模拟控制器状态后映射正确，无日志地址不请求。

    状态通过 s2irun 的 /status 子资源写入，是**模拟控制器汇报**：本环境的 s2ioperator
    无法 list/watch 自己的 CRD，真实控制器不会写 status。模拟仅用于验证映射，不作为构建成功证据。
    """

    ui = image_builder_page
    name = ui.unique("records")
    run_name = f"{name}-run-1"
    try:
        assert ui.create_builder(name, image_name="tc-e2e/records") == 201
        assert ui.create_run(name, run_name) == 201

        # Before the controller reports, the run state is empty and must not look finished.
        ui.open_detail(name)
        expect(ui.panel("records")).to_be_visible()
        expect(ui.page.locator(f'[data-ai-row="{run_name}"]')).to_be_visible()
        row = ui.page.locator(f'[data-ai-row="{run_name}"]').inner_text()
        assert "未知" in row, row
        assert "#1" in row, row

        # No logURL: the panel explains it instead of requesting a log that does not exist.
        ui.page.locator(f'[data-ai-id="image-builder-detail:run-log-toggle:{run_name}"]').click()
        expect(ui.page.locator(f'[data-ai-id="image-builder-detail:run-log-unavailable:{run_name}"]')).to_be_visible()

        status = ui.patch_run_status(
            run_name,
            {
                "runState": "Successful",
                "startTime": "2026-11-15T14:20:00Z",
                "completionTime": "2026-11-15T14:21:00Z",
                "s2iBuildSource": {
                    "sourceUrl": "https://github.com/kubesphere/hello-world.git",
                    "builderImage": "dockerhub.kubekey.local/kube-ai-hub/java-8-centos7:v3.2.0",
                    "revisionId": "master",
                },
                "s2iBuildResult": {
                    "imageName": "tc-e2e/records:latest",
                    "imageSize": 12345678,
                    "commandPull": "docker pull tc-e2e/records:latest",
                    "imageCreated": "2026-11-15T14:20:30Z",
                },
            },
        )
        assert status == 200, status

        ui.open_detail(name)
        expect(ui.panel("records")).to_be_visible()
        row = ui.page.locator(f'[data-ai-row="{run_name}"]').inner_text()
        assert "构建成功" in row, row
        assert "成功" in row, row
        assert "tc-e2e/records:latest" in row, row

        last_env = ui.page.locator('[data-ai-id="image-builder-detail:last-environment"]').inner_text()
        assert "dockerhub.kubekey.local/kube-ai-hub/java-8-centos7:v3.2.0" in last_env, last_env
        assert "hello-world.git" in last_env, last_env
        assert "master" in last_env, last_env
        screenshot(ui.page, "image-builder-records")
    finally:
        ui.delete_builder(name)
