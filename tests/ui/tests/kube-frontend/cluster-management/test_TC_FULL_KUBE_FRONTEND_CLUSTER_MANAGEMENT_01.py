from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_CLUSTER_MANAGEMENT_01(cluster_management_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01 集群管理：切换不刷新且没有项目工作区栏。"""

    ui = cluster_management_page
    ui.open("nodes")
    ui.wait_ready("nodes")
    assert ui.active_tab() == "area-tabs:nodes"

    # Being cluster-scoped is what makes this page useful: a project switcher here
    # would offer a choice that changes nothing, so its absence is part of the case.
    assert ui.workspace_bar_count == 0, "cluster-scoped pages must not render the project workspace bar"

    ui.page.wait_for_load_state("networkidle")
    ui.page.wait_for_timeout(300)

    documents: list[str] = []
    ui.page.on("request", lambda r: documents.append(r.url) if r.resource_type == "document" else None)

    ui.page.locator('[data-ai-id="area-tabs:namespaces"]').click()
    expect(ui.surface("namespaces")).to_be_visible()
    ui.wait_ready("namespaces")
    assert ui.active_tab() == "area-tabs:namespaces"
    assert ui.workspace_bar_count == 0

    ui.page.locator('[data-ai-id="area-tabs:nodes"]').click()
    expect(ui.surface("nodes")).to_be_visible()
    ui.wait_ready("nodes")
    assert ui.active_tab() == "area-tabs:nodes"

    assert documents == [], f"tab switching reloaded the document: {documents}"
    screenshot(ui.page, "cluster-management-tabs")
