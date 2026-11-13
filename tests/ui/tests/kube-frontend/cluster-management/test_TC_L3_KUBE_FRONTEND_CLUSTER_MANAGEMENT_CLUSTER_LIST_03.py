from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/apis/cluster.kubesphere.io/v1alpha1/clusters"


def _cluster(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{CLUSTERS}/{name}")
    return body if status == 200 and isinstance(body, dict) else None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_LIST_03(cluster_fleet_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-03 集群列表：移除成员集群。"""

    ui = cluster_fleet_page
    assert ui.api is not None
    name = f"tc-e2e-rm-{uuid.uuid4().hex[:6]}"

    # A throwaway member cluster: proxy, so nothing is dialled and nothing becomes ready.
    created, _ = ui.api.request(
        "POST",
        CLUSTERS,
        {
            "apiVersion": "cluster.kubesphere.io/v1alpha1",
            "kind": "Cluster",
            "metadata": {"name": name},
            "spec": {"provider": "", "connection": {"type": "proxy"}, "joinFederation": True},
        },
    )
    assert created in (200, 201), created

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
        surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        row.locator('button[aria-haspopup="menu"]').click()
        ui.page.get_by_role("menuitem", name="移除集群", exact=True).click()

        dialog = ui.page.locator('[data-ai-id="clusters:remove-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)
        confirm = ui.page.locator('[data-ai-id="clusters:remove-confirm"]')
        # A red button is dismissed by reflex; typing the name forces a look at which
        # cluster was picked, which is the mistake that actually happens.
        expect(confirm).to_be_disabled()
        ui.page.locator('[data-ai-id="clusters:remove-input"]').fill(name)
        expect(confirm).to_be_enabled()
        confirm.click()

        deadline = time.time() + 60
        while time.time() < deadline:
            if _cluster(ui.api, name) is None:
                break
            time.sleep(1)
        assert _cluster(ui.api, name) is None, "移除后仍能读到该集群对象"
        expect(surface.locator(f'[data-ai-row="{name}"]')).to_have_count(0, timeout=30_000)

        # ---- the host cluster cannot be removed: every other page depends on it ----
        host_row = surface.locator(f'[data-ai-row="{ui_config.cluster}"]')
        host_row.locator('button[aria-haspopup="menu"]').click()
        items = [text.strip() for text in ui.page.get_by_role("menuitem").all_inner_texts()]
        assert "移除集群" not in items, items
        ui.page.keyboard.press("Escape")

        screenshot(ui.page, "cluster-list-remove")
    finally:
        ui.api.request("DELETE", f"{CLUSTERS}/{name}")
