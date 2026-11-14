from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_PODS_02(cluster_management_page):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-02 保留搜索条件刷新容器组。"""
    ui = cluster_management_page
    keyword = f"tc-e2e-absent-{uuid.uuid4().hex}"
    ui.page.goto(ui.url("pods"))
    surface = ui.surface("cluster-pods")
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(surface).not_to_have_attribute("data-ai-state", "error")
    ui.pod_search().fill(keyword)
    expect(surface).to_have_attribute("data-ai-state", "empty", timeout=60_000)
    with ui.page.expect_response(
        lambda response: "/pods" in response.url and keyword in response.url and response.request.method == "GET",
        timeout=60_000,
    ) as pending:
        ui.pod_refresh().click()
    assert pending.value.ok
    expect(ui.pod_search()).to_have_value(keyword)
    expect(surface).to_have_attribute("data-ai-state", "empty", timeout=60_000)
