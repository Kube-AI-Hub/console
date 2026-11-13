from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

INGRESSES = "/apis/networking.k8s.io/v1/namespaces/default/ingresses"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_INGRESSES_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-INGRESSES-01 应用路由：编辑路由规则。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("ing")
    status, _ = ui._request(
        "POST",
        INGRESSES,
        {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "Ingress",
            "metadata": {"name": name, "namespace": "default"},
            "spec": {
                "rules": [
                    {
                        "host": "old.example.com",
                        "http": {
                            "paths": [
                                {
                                    "path": "/",
                                    "pathType": "Prefix",
                                    "backend": {"service": {"name": "kubernetes", "port": {"number": 443}}},
                                }
                            ]
                        },
                    }
                ]
            },
        },
    )
    assert status in (200, 201), status
    try:
        ui.open("ingresses")
        ui.ensure_row("ingresses", name)

        assert "编辑路由规则" in ui.row_actions("ingresses", name)
        ui.run_row_action("ingresses", name, "编辑路由规则")

        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        ui.page.locator("#ai-field-host").fill("new.example.com")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, body = ui._request("GET", f"{INGRESSES}/{name}")
        assert status == 200
        rules = (body.get("spec") or {}).get("rules") or []
        assert rules and rules[0].get("host") == "new.example.com", rules
        # The backend survives the edit: replacing the host must not drop the service.
        backend = rules[0]["http"]["paths"][0]["backend"]["service"]
        assert backend["name"] == "kubernetes", backend
        assert backend["port"] == {"number": 443}, backend
        screenshot(ui.page, "ingress-rules")
    finally:
        ui._request("DELETE", f"{INGRESSES}/{name}")
