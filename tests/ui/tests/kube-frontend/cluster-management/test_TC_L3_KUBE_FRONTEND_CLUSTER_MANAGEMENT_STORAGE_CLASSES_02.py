from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SC = "/kapis/resources.kubesphere.io/v1alpha3/storageclasses"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_STORAGE_CLASSES_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-02 存储类型详情。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{SC}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取存储类型列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("集群没有存储类型")

    target = items[0]
    name = target["metadata"]["name"]
    provisioner = target.get("provisioner") or ""
    reclaim = target.get("reclaimPolicy") or ""
    binding = target.get("volumeBindingMode") or ""

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses")
    surface = ui.page.locator('[data-ai-id="storageclasses:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    link = surface.locator(f'[data-ai-row="{name}"] a').first
    expect(link).to_have_attribute("href", f"/kube-frontend/clusters/{ui.cluster}/storageclasses/{name}")
    link.click()

    detail = ui.page.locator('[data-ai-id="sc-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    basic = ui.page.locator('[data-ai-id="sc-detail:basic"]').inner_text()
    if provisioner:
        assert str(provisioner) in basic, f"供应者应为 {provisioner}: {basic[:200]}"
    if reclaim:
        assert str(reclaim) in basic, f"回收策略应为 {reclaim}: {basic[:200]}"
    if binding:
        assert str(binding) in basic, f"绑定模式应为 {binding}: {basic[:200]}"
    # Capabilities are rendered as 是/否, never as booleans dressed up as strings.
    assert "是" in basic or "否" in basic, basic[:200]

    # Driver parameters are pairs; a class without them says so instead of showing nothing.
    params = ui.page.locator('[data-ai-id="sc-detail:parameters"]')
    expected_params = ((target.get("parameters")) or {})
    if expected_params:
        assert ui.page.locator('[data-ai-id="sc-detail:parameter-list"] dd').count() == len(expected_params)
    else:
        expect(params).to_contain_text("没有驱动参数", timeout=20_000)

    screenshot(ui.page, "storage-class-detail")
