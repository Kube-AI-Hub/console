from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_PROJECTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01 项目：列表四列与企业空间。"""

    ui = cluster_management_page
    namespaces = ui.list_namespaces()
    if not namespaces:
        pytest.skip("集群没有项目，无法核对项目列表")

    ui.open("namespaces")
    ui.wait_ready("namespaces")

    headers = ui.headers("namespaces")
    # The required columns, in order. Written as a subsequence so that adding a column
    # (CPU/内存/容器组数 were added later) does not break a case about these four.
    required = ["名称", "状态", "租户(企业空间)", "创建时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    names = ui.row_names("namespaces")
    assert names, "project list rendered no rows"

    first = next(n for n in namespaces if n["metadata"]["name"] == names[0])
    workspace = (first["metadata"].get("labels") or {}).get("kubesphere.io/workspace", "")
    text = ui.surface("namespaces").locator(f'[data-ai-row="{names[0]}"]').inner_text()
    assert (workspace or "-") in text, (workspace, text)
    screenshot(ui.page, "cluster-projects")
