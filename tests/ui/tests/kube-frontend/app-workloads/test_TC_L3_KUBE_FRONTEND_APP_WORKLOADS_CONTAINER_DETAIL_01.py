from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

PODS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/pods"
#: 资源、挂载卷、端口、探针在默认「资源状态」页签内；环境变量在「环境变量」页签内。
RESOURCE_TAB_SECTIONS = ("resources", "mounts", "ports", "probes")
#: 空内容有两种合法写法：说明文字（没有…），或每个字段一个「-」（资源请求/限制的既有约定）。
EMPTY_MARKERS = ("没有", "no ", "None", "-")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-01 容器详情。"""

    ui = app_workloads_page
    assert ui.api is not None

    status, body = ui._request("GET", f"{PODS}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取容器组列表")
    pod = None
    for item in body.get("items") or []:
        containers = ((item.get("spec") or {}).get("containers") or [])
        if containers:
            pod = {"name": item["metadata"]["name"], "container": containers[0]}
            break
    if pod is None:
        pytest.skip("项目里没有带容器的容器组")

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

    # Four of the five blocks live in the default tab: no click needed.
    expect(ui.page.locator('[data-ai-id="container-detail:tab-trigger:resources"]')).to_have_attribute(
        "aria-selected", "true"
    )
    for section in RESOURCE_TAB_SECTIONS:
        block = ui.page.locator(f'[data-ai-id="container-detail:{section}"]')
        expect(block).to_be_visible(timeout=20_000)
        text = block.inner_text()
        assert len(text.strip()) > 0, f"{section} 区块为空"
        # "Empty" must be an explanation, not a blank table: every block says so in words.
        assert any(marker in text for marker in EMPTY_MARKERS) or block.locator("[data-ai-row]").count() >= 1, (
            f"{section} 既没有内容也没有空态说明：{text[:120]!r}"
        )

    # The fifth block (environment variables) is on its own tab.
    ui.page.locator('[data-ai-id="container-detail:tab-trigger:env"]').click()
    expect(ui.page.locator('[data-ai-id="container-detail:tab:env"]')).to_be_visible(timeout=20_000)
    env_block = ui.page.locator('[data-ai-id="container-detail:env"]')
    expect(env_block).to_be_visible(timeout=20_000)
    env_text = env_block.inner_text()
    assert len(env_text.strip()) > 0, "环境变量区块为空"
    assert any(marker in env_text for marker in EMPTY_MARKERS) or env_block.locator("[data-ai-row]").count() >= 1, (
        f"环境变量区块既没有内容也没有空态说明：{env_text[:120]!r}"
    )

    # A name that is not in the pod shows a clear message rather than a blank page.
    ui.page.goto(f"{ui.base}/pods/{pod['name']}/containers/does-not-exist")
    missing = ui.page.locator('[data-ai-id="container-detail:missing"]')
    expect(missing).to_be_visible(timeout=30_000)

    screenshot(ui.page, "container-detail")
