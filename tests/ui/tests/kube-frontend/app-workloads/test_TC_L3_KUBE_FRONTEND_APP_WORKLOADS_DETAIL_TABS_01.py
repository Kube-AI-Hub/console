from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEPLOYMENTS = "/apis/apps/v1/namespaces/default/deployments"
PODS = "/api/v1/namespaces/default/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_TABS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-01 负载详情：页签体系。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("tabs")
    ui.create_deployment(
        name,
        replicas=2,
        image="nginx:1.27",
        annotations={"tc-e2e/owner": "tabs"},
    )
    try:
        # The pod tab only exists once the deployment owns pods; wait for them.
        expected = 0
        for _ in range(30):
            status, body = ui._request("GET", f"{PODS}?labelSelector=app%3D{name}")
            items = (body.get("items") or []) if status == 200 else []
            if items:
                expected = len(items)
                break
            ui.page.wait_for_timeout(2000)
        assert expected > 0, "the deployment started no pods"

        ui.page.goto(f"{ui.base}/deployments/{name}")
        surface = ui.detail_surface("deployments")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        triggers = {
            key: ui.page.locator(f'[data-ai-id="workload-detail:tab-trigger:{key}"]')
            for key in ("overview", "pods", "revisions", "events", "metadata")
        }
        for key, trigger in triggers.items():
            expect(trigger).to_be_visible(timeout=20_000)
        expect(triggers["overview"]).to_have_attribute("aria-selected", "true")

        panels = {
            key: ui.page.locator(f'[data-ai-id="workload-detail:tab:{key}"]')
            for key in ("overview", "pods", "revisions", "events", "metadata")
        }
        expect(panels["overview"]).to_be_visible()
        # The other panels are not mounted until their tab is opened; that is what makes
        # "switch tabs, do not refetch" observable: the blocks appear from cached data.
        expect(panels["events"]).to_have_count(0)

        triggers["events"].click()
        expect(panels["events"]).to_be_visible()
        events_block = ui.page.locator('[data-ai-id="deployments-detail:events"]')
        expect(events_block).to_be_visible()
        expect(events_block).to_contain_text("事件")

        triggers["metadata"].click()
        expect(panels["metadata"]).to_be_visible()
        labels_block = ui.page.locator('[data-ai-id="deployments-detail:labels"]')
        annotations_block = ui.page.locator('[data-ai-id="deployments-detail:annotations"]')
        expect(labels_block).to_be_visible()
        expect(annotations_block).to_be_visible()
        # The label the fixture wrote is the deployment name; the annotation is ours.
        expect(labels_block).to_contain_text(name)
        expect(annotations_block).to_contain_text("tc-e2e/owner")
        expect(annotations_block).to_contain_text("tabs")

        # Back to the pod tab: the rows are the same ones, from the query fetched once at
        # the top of the page rather than a second request on tab switch.
        triggers["pods"].click()
        pods_block = ui.page.locator('[data-ai-id="deployments-detail:pods"]')
        expect(pods_block).to_be_visible(timeout=30_000)
        expect(pods_block.locator("tbody tr")).to_have_count(expected)

        status, body = ui._request("GET", f"{PODS}?labelSelector=app%3D{name}")
        assert status == 200
        pod_name = (body.get("items") or [{}])[0].get("metadata", {}).get("name")
        assert pod_name, body

        ui.page.goto(f"{ui.base}/pods/{pod_name}")
        pod_surface = ui.page.locator('[data-ai-id="pods-detail:surface"]')
        expect(pod_surface).to_be_visible(timeout=30_000)
        expect(pod_surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        pod_triggers = {
            key: ui.page.locator(f'[data-ai-id="workload-detail:tab-trigger:{key}"]')
            for key in ("overview", "containers", "events", "metadata")
        }
        for key, trigger in pod_triggers.items():
            expect(trigger).to_be_visible(timeout=20_000)
        # A pod has no pod list of its own and keeps no revisions.
        expect(ui.page.locator('[data-ai-id="workload-detail:tab-trigger:pods"]')).to_have_count(0)
        expect(ui.page.locator('[data-ai-id="workload-detail:tab-trigger:revisions"]')).to_have_count(0)

        pod_triggers["containers"].click()
        expect(ui.page.locator('[data-ai-id="workload-detail:tab:containers"]')).to_be_visible()
        container_link = ui.page.locator('[data-ai-id="pods-detail:container:main"]')
        expect(container_link).to_be_visible()
        container_link.click()

        container_surface = ui.page.locator('[data-ai-id="container-detail:surface"]')
        expect(container_surface).to_be_visible(timeout=30_000)
        assert "/containers/main" in ui.page.url, ui.page.url
        screenshot(ui.page, "workload-detail-tabs")
    finally:
        ui.delete_deployment(name)
