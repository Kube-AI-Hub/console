from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLASSES = "/apis/storage.k8s.io/v1/storageclasses"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_STORAGE_CLASSES_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_CLASSES-01 存储类型：六列与能力标记。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", CLASSES)
    if status != 200:
        pytest.skip("无法读取存储类型")
    classes = body.get("items") or []
    if not classes:
        pytest.skip("集群没有存储类型，无法核对列表")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/storageclasses")
    surface = ui.page.locator('[data-ai-id="storageclasses:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    headers = [t.strip() for t in surface.locator("thead th:visible").all_inner_texts() if t.strip()]
    required = ["名称", "供应者", "存储卷数", "能力", "回收策略", "创建时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    assert surface.locator("[data-ai-row]").count() == len(classes)

    # The default class carries a badge; exactly the classes the annotation marks.
    defaults = [
        c["metadata"]["name"]
        for c in classes
        if ((c["metadata"].get("annotations") or {}).get("storageclass.kubernetes.io/is-default-class")) == "true"
    ]
    for name in defaults:
        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible()
        assert "默认" in row.inner_text(), row.inner_text()

    # A class without `allowVolumeExpansion` must not show the capability: rendering all
    # three with colours made every class look fully featured.
    for item in classes:
        if item.get("allowVolumeExpansion") is True:
            continue
        row = surface.locator(f'[data-ai-row="{item["metadata"]["name"]}"]')
        if row.count() == 0:
            continue
        assert "扩容" not in row.inner_text(), row.inner_text()
    screenshot(ui.page, "cluster-storage-classes")
