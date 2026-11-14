from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

COMPONENTS = "/kapis/resources.kubesphere.io/v1alpha3/components"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_COMPONENTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01 系统组件：三列与不健康优先。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", COMPONENTS)
    if status != 200:
        pytest.skip("无法读取系统组件")
    # This endpoint answers a bare array rather than `{ items }`; accept both so the
    # case does not silently compare against an empty list.
    components = body if isinstance(body, list) else (body.get("items") or []) if isinstance(body, dict) else []
    if not components:
        pytest.skip("平台没有组件数据，无法核对列表")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/components")
    surface = ui.page.locator('[data-ai-id="components:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    headers = [t.strip() for t in surface.locator("thead th:visible").all_inner_texts() if t.strip()]
    required = ["名称", "健康后端", "启动时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    assert surface.locator("[data-ai-row]").count() == len(components)

    # When anything is unhealthy it sorts to the top: finding it should not require
    # scanning 49 rows.
    unhealthy = [
        c for c in components
        if (c.get("totalBackends") or 0) == 0
        or (c.get("healthyBackends") or 0) != (c.get("totalBackends") or 0)
    ]
    if unhealthy:
        first = surface.locator("[data-ai-row]").first.inner_text()
        assert "无后端" in first or "/" in first, first
        # The first row's numbers must not be a fully healthy pair.
        for c in components:
            total = c.get("totalBackends") or 0
            healthy = c.get("healthyBackends") or 0
            if total > 0 and healthy == total and c["name"] in first:
                raise AssertionError(f"a healthy component sorted first while {len(unhealthy)} are unhealthy: {first}")
    surface.get_by_role("combobox").click()
    ui.page.get_by_role("option", name="监控", exact=True).click()
    expect(surface.locator("[data-ai-row]")).to_have_count(sum(c.get("namespace") == "kubesphere-monitoring-system" for c in components))
    surface.get_by_role("combobox").click()
    ui.page.get_by_role("option", name="全部组件", exact=True).click()
    expect(surface.locator("[data-ai-row]")).to_have_count(len(components))
    screenshot(ui.page, "cluster-components")
