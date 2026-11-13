from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/api/v1/namespaces/csghub/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_MOUNT_01(storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-MOUNT-01 存储卷列表：挂载状态。"""

    ui = storage_page
    assert ui.api is not None

    status, body = ui.api.request("GET", PODS)
    if status != 200:
        pytest.skip("无法读取项目内的容器组，挂载状态无法核对")
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
    for _ in range(60):
        if "计算中" not in surface.locator("tbody").inner_text():
            break
        ui.page.wait_for_timeout(2000)
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
