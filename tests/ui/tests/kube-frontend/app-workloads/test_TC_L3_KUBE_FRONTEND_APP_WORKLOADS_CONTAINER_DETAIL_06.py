from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"
UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
POSTSTART_PATH = "/healthz"
POSTSTART_PORT = 8080
PRESTOP_COMMAND = ["/bin/sh", "-c", "echo bye"]


def _create_pod(ui, name: str) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": name}},
        "spec": {
            "terminationGracePeriodSeconds": 0,
            "nodeSelector": UNSCHEDULABLE,
            "containers": [
                {
                    "name": "main",
                    "image": UNPULLABLE,
                    "lifecycle": {
                        "postStart": {"httpGet": {"path": POSTSTART_PATH, "port": POSTSTART_PORT, "scheme": "HTTP"}},
                        "preStop": {"exec": {"command": PRESTOP_COMMAND}},
                    },
                },
                # A second container without lifecycle: the block must be absent for it.
                {"name": "plain", "image": UNPULLABLE},
            ],
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建容器组 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _open(ui, pod: str, container: str):
    origin = ui.base.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/{ui.workspace}/clusters/{ui.cluster}/projects/default/pods/{pod}/containers/{container}")
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    return surface


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_06(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-06 容器详情：生命周期区块。"""

    ui = app_workloads_page
    assert ui.api is not None

    name = _create_pod(ui, ui.unique("lifecycle"))
    try:
        # ---- declared lifecycle: type and parameters, one row per hook ----
        _open(ui, name, "main")
        block = ui.page.locator('[data-ai-id="container-detail:lifecycle"]')
        expect(block).to_be_visible(timeout=20_000)

        post_start = ui.page.locator('[data-ai-id="container-detail:lifecycle:postStart"]')
        pre_stop = ui.page.locator('[data-ai-id="container-detail:lifecycle:preStop"]')
        expect(post_start).to_be_visible(timeout=20_000)
        expect(pre_stop).to_be_visible(timeout=20_000)

        post_text = post_start.inner_text()
        assert "启动后" in post_text, f"应标出 postStart：{post_text!r}"
        assert "HTTP 请求" in post_text, f"类型应为 HTTP 请求：{post_text!r}"
        assert POSTSTART_PATH in post_text, f"参数应含路径：{post_text!r}"
        assert str(POSTSTART_PORT) in post_text, f"参数应含端口：{post_text!r}"
        assert "HTTP" in post_text, f"参数应含 scheme：{post_text!r}"

        pre_text = pre_stop.inner_text()
        assert "停止前" in pre_text, f"应标出 preStop：{pre_text!r}"
        assert "命令" in pre_text, f"类型应为命令：{pre_text!r}"
        assert "echo bye" in pre_text, f"参数应含命令行：{pre_text!r}"

        screenshot(ui.page, "container-detail-lifecycle")

        # ---- no lifecycle declaration, no block ----
        _open(ui, name, "plain")
        expect(ui.page.locator('[data-ai-id="container-detail:basic"]')).to_be_visible(timeout=20_000)
        assert ui.page.locator('[data-ai-id="container-detail:lifecycle"]').count() == 0, (
            "未声明 lifecycle 的容器不该有生命周期区块"
        )
    finally:
        ui.delete_pod(name, timeout=120)
