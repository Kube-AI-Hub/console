from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_09(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-09 镜像制品：只列成功运行，字段与 status.s2iBuildResult 一致。

    运行状态由 /status 子资源写入，是模拟控制器汇报（真实 s2ioperator 在本环境没有 list/watch
    权限，不会写 status）；本用例验证的是页面映射，不是构建成功证据。
    """

    ui = image_builder_page
    if not ui.available():
        pytest.skip("本集群未安装 S2I 构建器 CRD（devops/s2ioperator），构建记录用例无法造数")
    name = ui.unique("artifacts")
    run_name = f"{name}-run-1"
    try:
        assert ui.create_builder(name, image_name="tc-e2e/artifacts") == 201
        assert ui.create_run(name, run_name) == 201
        status = ui.patch_run_status(
            run_name,
            {
                "runState": "Successful",
                "s2iBuildResult": {
                    "imageName": "tc-e2e/artifacts:latest",
                    "imageSize": 12345678,
                    "commandPull": "docker pull tc-e2e/artifacts:latest",
                    "imageCreated": "2026-11-15T14:20:30Z",
                },
            },
        )
        assert status == 200, status

        ui.open_detail(name)
        ui.open_tab("image-artifacts")
        table = ui.page.locator('[data-ai-id="image-builder-detail:artifacts-table"]')
        expect(table).to_be_visible()
        text = table.inner_text()
        assert "tc-e2e/artifacts:latest" in text, text
        assert "docker pull tc-e2e/artifacts:latest" in text, text
        # 12345678 bytes is 11.77 MB with the old 1024-based formatter.
        assert "11.77 MB" in text, text
        assert "2026-11-15" in text, text

        ui.page.context.grant_permissions(["clipboard-read", "clipboard-write"])
        ui.page.locator(f'[data-ai-id="image-builder-detail:artifact-copy:{run_name}"]').click()
        expect(ui.page.get_by_text("已复制")).to_be_visible(timeout=10_000)
        screenshot(ui.page, "image-builder-artifacts")
    finally:
        ui.delete_builder(name)