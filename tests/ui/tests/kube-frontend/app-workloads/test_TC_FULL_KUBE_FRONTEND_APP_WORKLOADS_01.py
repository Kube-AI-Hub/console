from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_APP_WORKLOADS_01(app_workloads_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-01 应用负载：页签切换不刷新文档，工作区栏保持项目。"""

    ui = app_workloads_page
    ui.open("deployments")

    expect(ui.tabs_nav).to_be_visible()
    expect(ui.workspace_bar).to_be_visible()
    expect(ui.current_project).to_contain_text("default")
    assert ui.active_tab_key() == "deployments", ui.page.url
    assert ui.state("deployments") in {"ready", "empty"}, ui.state("deployments")

    # The initial `goto` is a document request by definition; what the area
    # promises is that *switching tabs* never makes another one.
    documents: list[str] = []
    ui.page.on(
        "request",
        lambda request: documents.append(request.url) if request.resource_type == "document" else None,
    )

    labels = {"pods": "容器组", "services": "服务", "deployments": "部署"}
    for key in ("pods", "services", "deployments"):
        ui.switch_tab(key)
        assert ui.active_tab_key() == key, ui.page.url
        assert ui.active_tab_label() == labels[key]
        expect(ui.current_project).to_contain_text("default")

    assert ui.page.url.endswith("/projects/default/deployments"), ui.page.url
    assert documents == [], f"tab switches issued document requests: {documents}"
    screenshot(ui.page, "tabs")
