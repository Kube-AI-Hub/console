from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

LOGS = "/kapis/tenant.kubesphere.io/v1alpha2/logs"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_LOG_SEARCH_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01 容器日志查询。"""

    ui = cluster_management_page
    assert ui.api is not None

    end = int(time.time())
    start = end - 3600
    status, body = ui.api.request("GET", f"{LOGS}?start_time={start}&end_time={end}&size=50&from=0")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("日志接口不可用")
    envelope = body.get("query") or {}
    total = int(envelope.get("total") or 0)
    if total == 0:
        pytest.skip("最近 1 小时没有日志")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/logs")
    surface = ui.page.locator('[data-ai-id="cluster-logs:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    rows = ui.page.locator('[data-ai-id="cluster-logs:list"] [data-ai-row]')
    expect(rows).to_have_count(min(50, total), timeout=60_000)
    expect(ui.page.locator('[data-ai-id="cluster-logs:page"]')).to_be_visible(timeout=20_000)

    screenshot(ui.page, "cluster-logs")
