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
    if not ui.available():
        pytest.skip("本集群未安装 S2I 构建器 CRD（devops/s2ioperator），构建记录用例无法造数")
    name = ui.unique("records")
    run_name = f"{name}-run-1"
    try:
        assert ui.create_builder(name, image_name="tc-e2e/records") == 201
        assert ui.create_run(name, run_name) == 201

        # The row must agree with what the API reports: an unreported run reads 「未知」 and must
        # not look finished, while a controller that already reported `running` legitimately reads
        # 「构建中」. Asserting 「未知」 unconditionally failed as soon as this deployment's operator
        # started writing `runState` (2026-11-19).
        ui.open_detail(name)
        expect(ui.panel("records")).to_be_visible()
        expect(ui.page.locator(f'[data-ai-row="{run_name}"]')).to_be_visible()
        row = ui.page.locator(f'[data-ai-row="{run_name}"]').inner_text()
        # Read the run state *after* the row rendered: this deployment's operator writes
        # `runState` a moment after the run is created, so a status read taken before the render
        # says "unknown" while the row (correctly) says 构建中. The row must match whatever the
        # API reports at that moment.
        status, run_body = ui.request("GET", f"{ui._run_path(run_name)}")
        assert status == 200, (status, run_body)
        reported = str(((run_body.get("status") or {}).get("runState")) or "").lower()
        expected = (
            "状态未知" if not reported
            else "构建中" if reported in ("running", "building")
            else "构建成功" if reported in ("successful", "succeeded", "success")
            else "构建失败"
        )
        # The panel polls while a run is building or unreported, so the row catches up with the
        # API a moment later; wait for the agreement instead of sampling it once.
        import time as _time

        deadline = _time.time() + 25
        while _time.time() < deadline and expected not in row:
            ui.page.wait_for_timeout(500)
            row = ui.page.locator(f'[data-ai-row="{run_name}"]').inner_text()
        assert expected in row, (reported, row)
        assert "#1" in row, row

        # The panel must match the payload: no logURL means "explain, do not request"; a logURL
        # means fetching is right, and a failing fetch has to surface as an error with a retry
        # (this deployment's operator writes a logURL whose endpoint answers an error).
        has_log_url = bool(((run_body.get("status") or {}).get("logURL")) or "")
        ui.page.locator(f'[data-ai-id="image-builder-detail:run-log-toggle:{run_name}"]').click()
        if has_log_url:
            expect(
                ui.page.locator(
                    f'[data-ai-id="image-builder-detail:run-log-content:{run_name}"], '
                    f'[data-ai-id="image-builder-detail:run-log-error:{run_name}"]'
                ).first
            ).to_be_visible(timeout=20_000)
        else:
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

        # A live s2ioperator rewrites `runState` back to Running, so a simulated "Successful" does
        # not survive; the success mapping cannot be exercised on such a deployment. Detect the
        # overwrite and skip instead of asserting against a state the controller owns.
        import time as _time2

        confirm_deadline = _time2.time() + 10
        confirmed = ""
        while _time2.time() < confirm_deadline:
            status, run_body = ui.request("GET", f"{ui._run_path(run_name)}")
            confirmed = str(((run_body.get("status") or {}).get("runState")) or "")
            if confirmed.lower() in ("successful", "succeeded"):
                break
            ui.page.wait_for_timeout(500)
        if confirmed.lower() not in ("successful", "succeeded"):
            pytest.skip(f"本环境有真实 s2ioperator 持续写入运行状态（当前 {confirmed!r}），模拟成功态会被覆盖")

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