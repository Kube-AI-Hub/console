from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_05(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-05 服务详情：端口表。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("svc")
    status, _ = ui._request(
        "POST",
        "/api/v1/namespaces/default/services",
        {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {"name": name, "namespace": "default"},
            "spec": {"selector": {"app": name}, "ports": [{"name": "http", "port": 80, "targetPort": 8080}]},
        },
    )
    assert status in (200, 201), status
    try:
        ui.page.goto(f"{ui.base}/services/{name}")
        surface = ui.detail_surface("services")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        table = ui.page.locator('[data-ai-id="services-detail:ports"]')
        expect(table).to_be_visible(timeout=20_000)
        headers = [text.strip() for text in table.locator("th").all_inner_texts()]
        assert headers == ["端口名", "服务端口", "容器端口", "节点端口"], headers

        cells = [text.strip() for text in table.locator("tbody tr").first.locator("td").all_inner_texts()]
        assert cells[1] == "80", cells
        assert cells[2] == "8080", cells
        # A ClusterIP service has no node port; a zero here would be a false claim.
        assert cells[3] == "-", cells
        screenshot(ui.page, "service-ports")
    finally:
        ui._request("DELETE", f"/api/v1/namespaces/default/services/{name}")
