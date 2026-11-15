from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

EVENTS = "/kapis/tenant.kubesphere.io/v1alpha2/events?operation=query&from=0&size=20"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_EVENTS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EVENTS-01 资源事件查询：列表与分页。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", EVENTS)
    if status != 200 or not isinstance(body, dict):
        pytest.skip("租户事件接口不可用")
    query = body.get("query") or {}
    records = query.get("records") or []
    total = int(query.get("total") or 0)
    if not records:
        pytest.skip("集群没有事件")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/events")
    surface = ui.page.locator('[data-ai-id="cluster-events:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # Six columns, as the old console's event search renders them.
    headers = ui.page.locator('[data-ai-id="cluster-events:list"] thead th').all_inner_texts()
    assert [text.strip() for text in headers] == [
        "时间",
        "类别",
        "项目",
        "资源名称与类型",
        "原因",
        "消息",
    ], headers

    rows = ui.page.locator('[data-ai-id="cluster-events:list"] tbody tr')
    expect(rows).to_have_count(len(records), timeout=30_000)

    # The total is the API's, not a client-side window.
    total_note = ui.page.locator('[data-ai-id="cluster-events:total"]').inner_text()
    assert str(total) in total_note, (total, total_note)

    # Pagination is present and the first page cannot go back.
    page_note = ui.page.locator('[data-ai-id="cluster-events:page"]').inner_text()
    assert page_note.strip().startswith("1 /"), page_note
    expect(ui.page.locator('[data-ai-id="cluster-events:previous"]')).to_be_disabled()

    screenshot(ui.page, "cluster-events-search")
