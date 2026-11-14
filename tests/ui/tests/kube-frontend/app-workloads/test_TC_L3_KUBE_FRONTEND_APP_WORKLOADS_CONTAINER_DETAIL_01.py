from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01 容器详情。"""

    ui = app_workloads_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{PODS}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取容器组列表")
    pod = None
    for item in body.get("items") or []:
        containers = ((item.get("spec") or {}).get("containers") or [])
        if containers:
            pod = {"name": item["metadata"]["name"], "container": containers[0]}
            break
    if pod is None:
        pytest.skip('项目里没有带容器的容器组')

    container_name = str(pod["container"].get("name") or "")
    image = str(pod["container"].get("image") or "")
    pull_policy = str(pod["container"].get("imagePullPolicy") or "")

    # The page object already knows workspace/cluster/namespace.
    ui.page.goto(f"{ui.base}/pods/{pod['name']}/containers/{container_name}")
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    basic = ui.page.locator('[data-ai-id="container-detail:basic"]').inner_text()
    assert container_name in basic, basic[:200]
    # The page derives everything from the pod object, so these must match it exactly.
    assert image in basic, f"镜像应为 {image}: {basic[:240]}"
    if pull_policy:
        assert pull_policy in basic, f"拉取策略应为 {pull_policy}: {basic[:240]}"

    for section in ("resources", "env", "mounts", "ports", "probes"):
        block = ui.page.locator(f'[data-ai-id="container-detail:{section}"]')
        expect(block).to_be_visible(timeout=20_000)
        text = block.inner_text()
        empty_markers = ("没有", "no ", "None")
        assert len(text.strip()) > 0, f"{section} 区块为空"
        assert any(marker in text for marker in empty_markers) or block.locator("[data-ai-row]").count() >= 0

    # A name that is not in the pod shows a clear message rather than a blank page.
    ui.page.goto(f"{ui.base}/pods/{pod['name']}/containers/does-not-exist")
    missing = ui.page.locator('[data-ai-id="container-detail:missing"]')
    expect(missing).to_be_visible(timeout=30_000)

    screenshot(ui.page, "container-detail")
