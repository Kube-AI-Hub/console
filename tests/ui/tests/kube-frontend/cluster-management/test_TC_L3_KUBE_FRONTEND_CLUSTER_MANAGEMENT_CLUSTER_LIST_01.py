from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/kapis/cluster.kubesphere.io/v1alpha1/clusters"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_LIST_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01 集群列表：平台入口与就绪状态。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", CLUSTERS)
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取集群集合")
    clusters = body.get("items") or []
    if not clusters:
        pytest.skip("平台没有注册集群，无法核对列表")

    target = clusters[0]
    name = target["metadata"]["name"]
    conditions = ((target.get("status") or {}).get("conditions")) or []
    ready_condition = next((c for c in conditions if c.get("type") == "Ready"), None)

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
    required = ["名称", "状态", "Kubernetes 版本", "节点数", "创建时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    rows = surface.locator("[data-ai-row]")
    assert rows.count() == len(clusters), f"行数 {rows.count()} 与接口的 {len(clusters)} 不一致"

    # ---- US2: readiness matches the object, and a not-ready row explains itself ----
    row_text = surface.locator(f'[data-ai-row="{name}"]').inner_text()
    if ready_condition is not None and ready_condition.get("status") == "True":
        assert "运行正常" in row_text, f"{name} Ready=True 但未显示运行正常: {row_text[:120]}"
    else:
        assert "运行正常" not in row_text, f"{name} 未就绪却显示运行正常: {row_text[:120]}"
        message = (ready_condition or {}).get("message")
        if message:
            assert str(message)[:20] in row_text, f"未就绪行未显示原因: {row_text[:160]}"

    # ---- US1: the name is the way in ----
    link = surface.locator(f'[data-ai-row="{name}"] a').first
    expect(link).to_have_attribute("href", f"/kube-frontend/clusters/{name}/overview")
    link.click()
    expect(ui.page.locator('[data-ai-id="overview:surface"]').last).to_be_visible(timeout=30_000)
    assert f"/clusters/{name}/overview" in ui.page.url, ui.page.url

    # ---- A cluster id that does not exist must say so, not render an empty console ----
    # The route keeps the URL (the reader may have a typo to fix) and the surrounding
    # console stays usable, so this is a state inside the page rather than a blank shell.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/no-such-cluster-xyz/nodes")
    expect(ui.page.locator('[data-ai-id="nodes:surface"]').last).to_have_attribute(
        "data-ai-state", "error", timeout=30_000
    )
    main_text = ui.page.locator("main").inner_text()
    assert "资源不存在" in main_text, main_text[:200]
    assert "重试" in main_text, main_text[:200]

    screenshot(ui.page, "cluster-list")
