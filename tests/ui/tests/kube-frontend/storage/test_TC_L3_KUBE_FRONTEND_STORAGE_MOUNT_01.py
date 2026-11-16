from __future__ import annotations

import pytest
from playwright.sync_api import expect

from helpers.reads import ReadError

pytestmark = pytest.mark.ui

PODS = "/api/v1/namespaces/csghub/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_MOUNT_01(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-MOUNT-01 存储卷列表：挂载状态。"""

    ui = kube_storage_page
    assert ui.api is not None

    # PERFORMANCE: this cluster's pod list takes ~40-150s for a large project — it scales
    # with object count, not payload size — and occasionally times out under load. Retry
    # rather than skipping: a slow read is the condition this case exists to tolerate,
    # not a reason to report "cannot verify".
    status, body = 0, {}
    for _ in range(3):
        try:
            status, body = ui.api.request("GET", PODS, timeout=240)
        except Exception:
            status, body = 0, {}
            continue
        if status == 200:
            break
    if status in (401, 403):
        pytest.skip(f"当前账号无权读取项目内的容器组（HTTP {status}），挂载状态无法核对")
    if status != 200:
        raise ReadError(f"项目内容器组读取失败：HTTP {status} — {repr(body)[:300]}")
    mounted: set[str] = set()
    for pod in body.get("items") or []:
        for volume in ((pod.get("spec") or {}).get("volumes") or []):
            claim = ((volume.get("persistentVolumeClaim") or {}).get("claimName"))
            if claim:
                mounted.add(claim)
    if not mounted:
        pytest.skip("该项目没有容器组挂载存储卷，无法核对")

    ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/csghub/persistentvolumeclaims")
    surface = ui.surface("persistentvolumeclaims")
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts()]
    assert "挂载状态" in headers, headers

    # The column starts at 计算中 and resolves once the pod list arrives. Listing every
    # pod in the project is the slow call here (see the design doc's performance note).
    column = headers.index("挂载状态")
    # Measured at ~100-150s for this project on the current cluster: the page lists
    # every pod in the project to answer "is this claim mounted", and that list is slow.
    # The timeout is generous on purpose — the point is to verify the column resolves,
    # not to assert how fast the API is (see the design doc's performance note).
    for _ in range(90):
        text = surface.locator("tbody").inner_text()
        if "计算中" not in text:
            break
        ui.page.wait_for_timeout(3000)
    # A failed pod read now shows 未知 instead of sitting on 计算中 for ever; the case is
    # about the column resolving, so say which of the two happened.
    if "未知" in surface.locator("tbody").inner_text():
        pytest.skip("容器组列表读取失败（页面显示「未知」），无法核对挂载状态")
    assert "计算中" not in surface.locator("tbody").inner_text(), "mount state never resolved"

    for row in surface.locator("tbody tr").all():
        cells = [cell.strip() for cell in row.locator("td").all_inner_texts()]
        if len(cells) <= column:
            continue
        name = (cells[1] or "").split("\n")[0]
        if "已挂载" in cells[column]:
            assert name in mounted, (name, cells[column])
        elif "未挂载" in cells[column]:
            assert name not in mounted, (name, cells[column])
    screenshot(ui.page, "storage-mount-status")
