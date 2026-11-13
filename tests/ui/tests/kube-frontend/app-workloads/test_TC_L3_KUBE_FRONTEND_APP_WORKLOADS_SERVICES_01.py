from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SERVICES = "/api/v1/namespaces/default/services"


def _create(ui, name: str, spec: dict) -> None:
    # `_request` is the page object's own helper: it wraps the shared ApiClient and
    # returns `(status, body)` for the page's namespace.
    status, body = ui._request(
        "POST",
        SERVICES,
        {"apiVersion": "v1", "kind": "Service", "metadata": {"name": name, "namespace": "default"}, "spec": spec},
    )
    assert status in (200, 201), (status, body)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_SERVICES_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICES-01 服务：端口列与编辑端口。"""

    ui = app_workloads_page
    name = ui.unique("svc")
    external = ui.unique("ext")
    _create(ui, name, {"type": "ClusterIP", "selector": {"app": name}, "ports": [{"name": "http", "port": 80, "targetPort": 8080}]})
    # An ExternalName service has no ports, so the control must not be offered.
    _create(ui, external, {"type": "ExternalName", "externalName": "example.com"})
    try:
        ui.open("services")
        ui.wait_ready(ui.surface("services"))
        ui.ensure_row("services", name)

        # The ports column is the field an operator checks most often on this page.
        assert "80→8080" in ui.row_text("services", name)

        ui.row("services", name).locator('button[aria-label="更多操作"]').click()
        actions = [t.strip() for t in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "编辑服务" in actions, actions
        ui.page.get_by_role("menuitem", name="编辑服务", exact=True).click()

        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        ui.page.locator("#ai-field-port1").fill("8080")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, body = ui._request("GET", f"{SERVICES}/{name}")
        assert status == 200
        ports = (body.get("spec") or {}).get("ports") or []
        assert len(ports) == 1, ports
        assert ports[0].get("port") == 8080, ports
        # The port keeps its name: renaming it would break named targetPort references.
        assert ports[0].get("name") == "http", ports

        ui.ensure_row("services", external)
        ui.row("services", external).locator('button[aria-label="更多操作"]').click()
        actions_external = [t.strip() for t in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "编辑服务" not in actions_external, actions_external
        screenshot(ui.page, "workloads-service-ports")
    finally:
        for service in (name, external):
            ui._request("DELETE", f"{SERVICES}/{service}")
