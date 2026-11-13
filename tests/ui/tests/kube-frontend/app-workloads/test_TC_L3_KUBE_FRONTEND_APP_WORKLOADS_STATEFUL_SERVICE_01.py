from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SERVICES = "/api/v1/namespaces/default/services"
STATEFULSETS = "/apis/apps/v1/namespaces/default/statefulsets"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_STATEFUL_SERVICE_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATEFUL_SERVICE-01 有状态副本集详情：关联服务。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("sts")
    status, _ = ui._request(
        "POST",
        SERVICES,
        {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {"name": name, "namespace": "default"},
            # Headless: the form every StatefulSet's governing service takes.
            "spec": {"clusterIP": "None", "selector": {"app": name}, "ports": [{"name": "http", "port": 80}]},
        },
    )
    assert status in (200, 201), status
    try:
        status, _ = ui._request(
            "POST",
            STATEFULSETS,
            {
                "apiVersion": "apps/v1",
                "kind": "StatefulSet",
                "metadata": {"name": name, "namespace": "default"},
                "spec": {
                    "serviceName": name,
                    "replicas": 1,
                    "selector": {"matchLabels": {"app": name}},
                    "template": {
                        "metadata": {"labels": {"app": name}},
                        "spec": {"containers": [{"name": "c", "image": "nginx:1.27"}]},
                    },
                },
            },
        )
        assert status in (200, 201), status
        time.sleep(2)

        ui.page.goto(f"{ui.base}/statefulsets/{name}")
        surface = ui.detail_surface("statefulsets")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        block = ui.page.locator('[data-ai-id="statefulsets-detail:service"]')
        expect(block).to_be_visible(timeout=30_000)
        text = block.inner_text()
        assert name in text, text
        # A headless service is the reason a StatefulSet's pods get stable DNS names.
        assert "Headless" in text, text
        assert "80/TCP" in text, text
        # The happy path must not show the "missing service" warning.
        expect(ui.page.locator('[data-ai-id="statefulsets-detail:service-missing"]')).to_have_count(0)
        screenshot(ui.page, "statefulset-governing-service")
    finally:
        ui._request("DELETE", f"{STATEFULSETS}/{name}")
        ui._request("DELETE", f"{SERVICES}/{name}")
