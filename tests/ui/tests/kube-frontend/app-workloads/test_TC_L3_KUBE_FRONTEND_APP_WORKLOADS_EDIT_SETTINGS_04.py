from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
CLUSTER = "host"
NS = "default"
DEPLOYMENTS = f"/apis/apps/v1/namespaces/{NS}/deployments"
STATEFULSETS = f"/apis/apps/v1/namespaces/{NS}/statefulsets"


def _wait_readable(api, path: str) -> None:
    deadline = time.time() + 60
    while time.time() < deadline:
        status, _ = api.request("GET", path)
        if status == 200:
            return
        time.sleep(2)
    raise AssertionError(f"object did not become readable: {path}")


def _create(api, collection: str, body: dict, kapis_path: str) -> None:
    status, answer = api.request("POST", collection, body)
    assert status in (200, 201), (status, answer)
    _wait_readable(api, kapis_path)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_EDIT_SETTINGS_04(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-04 编辑设置：更新策略。"""

    ui = app_workloads_page
    assert ui.api is not None
    # `ui.base` is the project URL; the app origin is what a detail URL is built from.
    origin = ui.base.split("/kube-frontend/")[0]
    deployment = f"tc-e2e-strat-{uuid.uuid4().hex[:8]}"
    statefulset = f"tc-e2e-strat-sts-{uuid.uuid4().hex[:8]}"

    try:
        _create(
            ui.api,
            DEPLOYMENTS,
            {
                "apiVersion": "apps/v1",
                "kind": "Deployment",
                "metadata": {"name": deployment, "namespace": NS},
                "spec": {
                    "replicas": 1,
                    "selector": {"matchLabels": {"app": deployment}},
                    "template": {
                        "metadata": {"labels": {"app": deployment}},
                        "spec": {"containers": [{"name": "app", "image": "nginx:1.27"}]},
                    },
                },
            },
            f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{NS}/deployments/{deployment}",
        )

        ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/deployments/{deployment}")
        surface = ui.page.locator('[data-ai-id="deployments-detail:surface"]').last
        expect(surface).to_be_visible(timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="deployments-edit:strategy"]')).to_be_visible(timeout=20_000)

        # Recreate: the rolling parameters go away with the strategy that used them.
        ui.page.locator('[data-ai-id="deployments-edit:strategy-type"]').click()
        ui.page.get_by_role("option", name="同时更新（重建）", exact=True).click()
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(dialog).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{deployment}")
        assert status == 200
        strategy = (body.get("spec") or {}).get("strategy") or {}
        assert strategy.get("type") == "Recreate", strategy
        assert "rollingUpdate" not in strategy, strategy

        # Back to RollingUpdate with a chosen maxSurge; the other parameter the server set stays.
        ui.page.locator('[data-ai-id="deployments-detail:edit-settings"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="deployments-edit:strategy-type"]').click()
        ui.page.get_by_role("option", name="滚动更新", exact=True).click()
        ui.page.locator('[data-ai-id="deployments-edit:strategy-max-surge"]').fill("50%")
        ui.page.locator('[data-ai-id="deployments-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{DEPLOYMENTS}/{deployment}")
        strategy = (body.get("spec") or {}).get("strategy") or {}
        assert strategy.get("type") == "RollingUpdate", strategy
        assert (strategy.get("rollingUpdate") or {}).get("maxSurge") == "50%", strategy
        screenshot(ui.page, "workload-edit-strategy")

        # A StatefulSet keeps the same control under spec.updateStrategy.
        _create(
            ui.api,
            STATEFULSETS,
            {
                "apiVersion": "apps/v1",
                "kind": "StatefulSet",
                "metadata": {"name": statefulset, "namespace": NS},
                "spec": {
                    "replicas": 1,
                    "serviceName": statefulset,
                    "selector": {"matchLabels": {"app": statefulset}},
                    "template": {
                        "metadata": {"labels": {"app": statefulset}},
                        "spec": {"containers": [{"name": "app", "image": "nginx:1.27"}]},
                    },
                },
            },
            f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{NS}/statefulsets/{statefulset}",
        )
        ui.page.goto(f"{origin}/kube-frontend/{WS}/clusters/{CLUSTER}/projects/{NS}/statefulsets/{statefulset}")
        sts_surface = ui.page.locator('[data-ai-id="statefulsets-detail:surface"]').last
        expect(sts_surface).to_be_visible(timeout=60_000)
        expect(sts_surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        ui.page.locator('[data-ai-id="statefulsets-detail:edit-settings"]').click()
        expect(ui.page.get_by_role("dialog")).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="statefulsets-edit:strategy-type"]').click()
        ui.page.get_by_role("option", name="手动更新", exact=True).click()
        ui.page.locator('[data-ai-id="statefulsets-edit:submit"]').click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=60_000)
        status, body = ui.api.request("GET", f"{STATEFULSETS}/{statefulset}")
        update_strategy = (body.get("spec") or {}).get("updateStrategy") or {}
        assert update_strategy.get("type") == "OnDelete", update_strategy
    finally:
        ui.api.request("DELETE", f"{DEPLOYMENTS}/{deployment}")
        ui.api.request("DELETE", f"{STATEFULSETS}/{statefulset}")
