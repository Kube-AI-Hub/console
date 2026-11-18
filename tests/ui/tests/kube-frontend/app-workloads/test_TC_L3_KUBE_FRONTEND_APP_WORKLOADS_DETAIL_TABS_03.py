from __future__ import annotations

from urllib.parse import unquote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

UNSCHEDULABLE = {"tc-e2e-no-such-node": "true"}
UNPULLABLE = "tc-e2e.invalid/never-pulled:1.0"
#: 一个设备分配注解：容器段用 ; 分隔、设备段用 : 分隔、设备四段 uuid,type,mem,core。
GPU_UUID = "GPU-tc-e2e-0001"
GPU_ANNOTATION = f"{GPU_UUID},NVIDIA,8192,50"


def _create_pod(ui, name: str, annotations: dict[str, str]) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "Pod",
        "metadata": {"name": name, "namespace": "default", "labels": {"app": name}, "annotations": annotations},
        "spec": {
            "terminationGracePeriodSeconds": 0,
            "containers": [{"name": "main", "image": UNPULLABLE}],
            "nodeSelector": UNSCHEDULABLE,
        },
    }
    status, payload = ui._request("POST", "/api/v1/namespaces/default/pods", body)
    assert status in (200, 201), f"创建容器组 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _open_schedule(ui, name: str):
    ui.open_detail("pods", name)
    surface = ui.detail_surface("pods")
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    ui.page.locator('[data-ai-id="workload-detail:tab-trigger:schedule"]').click()
    expect(ui.page.locator('[data-ai-id="workload-detail:tab:schedule"]')).to_be_visible(timeout=20_000)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_TABS_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-03 容器组详情：GPU 分配区块。"""

    ui = app_workloads_page
    assert ui.api is not None

    with_gpu = _create_pod(ui, ui.unique("gpu"), {"kubesphere.io/gpu-devices-allocated": GPU_ANNOTATION})
    without_gpu = _create_pod(ui, ui.unique("nogpu"), {})
    try:
        # ---- the annotation is the only source, and each device is one row ----
        _open_schedule(ui, with_gpu)
        block = ui.page.locator('[data-ai-id="pods-detail:schedule-gpu"]')
        expect(block).to_be_visible(timeout=20_000)
        rows = block.locator("[data-ai-row]")
        assert rows.count() == 1, f"一个设备应占一行：{block.inner_text()!r}"
        row = rows.first
        row_text = row.inner_text()
        # vendor / memory MiB / core percent come from the annotation, field by field
        assert "NVIDIA" in row_text, f"应显示厂商：{row_text!r}"
        assert "8192" in row_text, f"应显示显存 MiB：{row_text!r}"
        assert "50" in row_text, f"应显示算力百分比：{row_text!r}"

        link = row.locator(f'[data-ai-id="pods-detail:gpu:{GPU_UUID}"]')
        expect(link).to_be_visible(timeout=20_000)
        assert link.inner_text().strip() == GPU_UUID, link.inner_text()
        href = link.get_attribute("href") or ""
        assert unquote(href).endswith(f"/clusters/{ui.cluster}/gpus/{GPU_UUID}"), (
            f"设备 uuid 应链到该设备的 GPU 状态页：{href}"
        )

        screenshot(ui.page, "pods-detail-schedule-gpu")

        # ---- no annotation, no block ----
        _open_schedule(ui, without_gpu)
        expect(ui.page.locator('[data-ai-id="pods-detail:schedule-result"]')).to_be_visible(timeout=20_000)
        assert ui.page.locator('[data-ai-id="pods-detail:schedule-gpu"]').count() == 0, (
            "注解里没有 GPU 分配时不该渲染该区块"
        )
    finally:
        ui.delete_pod(with_gpu, timeout=120)
        ui.delete_pod(without_gpu, timeout=120)
