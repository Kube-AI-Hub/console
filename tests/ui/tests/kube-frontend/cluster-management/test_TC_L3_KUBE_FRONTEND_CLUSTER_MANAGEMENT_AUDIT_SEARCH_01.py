from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

AUDIT = "/kapis/tenant.kubesphere.io/v1alpha2/auditing/events"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_AUDIT_SEARCH_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-AUDIT_SEARCH-01 审计日志查询。"""

    ui = cluster_management_page
    assert ui.api is not None

    end = int(time.time())
    start = end - 3600
    status, body = ui.api.request("GET", f"{AUDIT}?operation=query&start_time={start}&end_time={end}&size=50&from=0")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("审计接口不可用")
    envelope = body.get("query") or {}
    total = int(envelope.get("total") or 0)
    if total == 0:
        pytest.skip("最近 1 小时没有审计记录")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/audit-logs")
    surface = ui.page.locator('[data-ai-id="cluster-audit-logs:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    rows = ui.page.locator('[data-ai-id="cluster-audit-logs:list"] [data-ai-row]')
    expect(rows).to_have_count(min(50, total), timeout=60_000)
    expect(ui.page.locator('[data-ai-id="cluster-audit-logs:page"]')).to_be_visible(timeout=20_000)

    screenshot(ui.page, "cluster-audit-logs")
