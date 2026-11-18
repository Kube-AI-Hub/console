from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

COMPONENTS = "/kapis/resources.kubesphere.io/v1alpha3/components"
PAGE_SIZE = 20


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_12(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-12 每页档位：一次读全的列表在客户端切片。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", COMPONENTS)
    if status != 200:
        pytest.skip("无法读取系统组件")
    components = body if isinstance(body, list) else (body.get("items") or []) if isinstance(body, dict) else []
    total = len(components)
    if total <= PAGE_SIZE:
        pytest.skip(f"系统组件只有 {total} 条，不足一页，无法验证翻页")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/components")
    surface = ui.page.locator('[data-ai-id="components:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    rows = surface.locator("[data-ai-row]")
    # First screen: one page of rows, and the pager still reports the whole collection.
    expect(rows).to_have_count(PAGE_SIZE, timeout=30_000)
    body_text = ui.page.inner_text("body")
    assert f"共 {total} 条" in body_text, f"分页器应显示全部 {total} 条：{body_text[-200:]!r}"

    # Paging only moves the window over the same data.
    ui.page.get_by_role("button", name="下一页").click()
    expect(rows).to_have_count(min(total - PAGE_SIZE, PAGE_SIZE), timeout=30_000)

    # 50 per page: the whole collection fits, and the pager returns to page one.
    ui.page.locator('[data-ai-id="components:page-size"]').click()
    ui.page.get_by_role("option", name="50", exact=True).click()
    expect(rows).to_have_count(min(total, 50), timeout=30_000)
    assert f"第 1-" in ui.page.inner_text("body"), "切换每页条数后应回到第 1 页"
    screenshot(ui.page, "list-page-size")
