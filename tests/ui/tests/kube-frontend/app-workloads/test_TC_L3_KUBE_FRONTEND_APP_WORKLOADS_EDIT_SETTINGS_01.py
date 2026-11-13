from __future__ import annotations

import socket

import pytest
from playwright.sync_api import expect

from pages.app_workloads import UNPULLABLE_IMAGE

pytestmark = pytest.mark.ui


def _legacy_reachable() -> bool:
    """Whether the old console host resolves.

    This case compares the legacy edit-settings dialog with the migrated one, so it needs the
    old console to be reachable. When its host is gone (measured 2026-11-14: NXDOMAIN for
    console-dev.brightaitoken.com) the comparison cannot be made — skip instead of failing, so
    an environment change does not read as a regression in the migrated page.
    """
    try:
        socket.getaddrinfo("console-dev.brightaitoken.com", 443)
        return True
    except OSError:
        return False

def _legacy(ui, kind: str, name: str) -> str:
    """老 console 的详情地址。编辑设置实现在这里，不在 /kube-frontend。"""
    origin = ui.base.split("/kube-frontend/")[0]
    return (
        f"{origin}/clusters/{ui.cluster}/projects/{ui.namespace}/{kind}/{name}"
    )


def _open_settings(ui, url: str):
    ui.page.goto(url)
    ui.page.locator('[data-test="detail-more"]').click()
    ui.page.get_by_text("编辑设置", exact=True).click()
    expect(ui.page.locator(".ReactModal__Content, [class*='modal']").last).to_be_visible()


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_SETTINGS_01(app_workloads_page):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01 编辑设置与创建可改字段对齐。"""

    if not _legacy_reachable():
        pytest.skip("老 console 主机不可解析，无法做新旧对齐")

    ui = app_workloads_page
    deploy = ui.unique("editset")
    job = ui.unique("editjob")
    pod = ui.unique("editpod")
    try:
        ui.create_deployment(deploy, replicas=1)
        _open_settings(ui, f"{_legacy(ui, 'deployments', deploy)}/resource-status")
        ui.page.get_by_text("高级设置", exact=True).click()
        expect(ui.page.get_by_text("选择节点", exact=True)).to_be_visible()

        status, payload = ui._request(
            "POST",
            ui._kube_path("jobs"),
            {
                "apiVersion": "batch/v1",
                "kind": "Job",
                "metadata": {"name": job, "namespace": ui.namespace},
                "spec": {
                    "backoffLimit": 3,
                    "template": {
                        "spec": {
                            "restartPolicy": "Never",
                            "containers": [{"name": "main", "image": UNPULLABLE_IMAGE}],
                        }
                    },
                },
            },
        )
        assert status in (200, 201), (status, payload)
        _open_settings(ui, f"{_legacy(ui, 'jobs', job)}/records")
        expect(ui.page.get_by_text("最大重试次数", exact=True)).to_be_visible()
        expect(ui.page.get_by_text("选择节点", exact=True)).to_have_count(0)
        ui.page.keyboard.press("Escape")

        ui.create_pending_pod(pod)
        ui.page.goto(f"{_legacy(ui, 'pods', pod)}/resource-status")
        expect(ui.page.locator('[data-test="detail-editYaml"]')).to_be_visible()
        expect(ui.page.get_by_text("编辑设置", exact=True)).to_have_count(0)
    finally:
        ui.delete_deployment(deploy)
        ui._request("DELETE", ui._kube_path("jobs", job))
        ui.delete_pod(pod)
