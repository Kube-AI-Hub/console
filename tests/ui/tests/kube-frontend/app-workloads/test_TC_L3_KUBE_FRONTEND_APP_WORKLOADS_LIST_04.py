from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_04(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04 容器组列表：节点与 Pod IP 列。"""

    ui = app_workloads_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{PODS}?limit=50")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取容器组列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("项目里没有容器组")

    scheduled = None
    for item in items:
        node = (item.get("spec") or {}).get("nodeName")
        if node:
            scheduled = (item["metadata"]["name"], node, (item.get("status") or {}).get("podIP") or "")
            break
    if scheduled is None:
        pytest.skip("没有已调度的容器组，无法核对节点列")

    name, node, pod_ip = scheduled

    ui.open("pods")
    surface = ui.surface("pods")
    expect(surface).to_be_visible(timeout=30_000)
    ui.wait_ready(surface)

    headers = [header.strip() for header in surface.locator("thead th:visible").all_inner_texts() if header.strip()]
    assert "所在节点" in headers, headers
    assert "容器组 IP" in headers, headers

    row = surface.locator(f'tbody tr[data-ai-row="{name}"]')
    if row.count() == 0:
        pytest.skip(f"容器组 {name} 不在当前页，无法核对具体值")
    text = row.inner_text()
    assert node in text, f"节点应为 {node}: {text}"
    if pod_ip:
        assert pod_ip in text, f"Pod IP 应为 {pod_ip}: {text}"

    screenshot(ui.page, "pods-list-columns")
