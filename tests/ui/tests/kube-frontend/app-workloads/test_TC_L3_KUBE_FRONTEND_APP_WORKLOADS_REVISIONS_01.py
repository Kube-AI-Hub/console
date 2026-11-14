from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

DEPLOYMENTS = "/apis/apps/v1/namespaces/default/deployments"


def _template(name: str, image: str) -> dict:
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": name, "namespace": "default"},
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": name}},
            "template": {
                "metadata": {"labels": {"app": name}},
                "spec": {"containers": [{"name": "c", "image": image}]},
            },
        },
    }


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_REVISIONS_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01 部署详情：版本历史与回滚。"""

    ui = app_workloads_page
    assert ui.api is not None
    name = ui.unique("rev")
    first_image = "nginx:1.27"
    ui.create_deployment(name, replicas=1, image=first_image)
    try:
        # Two image changes make three revisions; each needs its own resourceVersion.
        for image in ("nginx:1.28", "nginx:1.29"):
            ui.page.wait_for_timeout(3000)
            status, body = ui._request("GET", f"{DEPLOYMENTS}/{name}")
            assert status == 200
            updated = _template(name, image)
            updated["metadata"]["resourceVersion"] = body["metadata"]["resourceVersion"]
            status, _ = ui._request("PUT", f"{DEPLOYMENTS}/{name}", updated)
            assert status == 200, status

        ui.page.goto(f"{ui.base}/deployments/{name}")
        surface = ui.detail_surface("deployments")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        # Revision history moved onto its own tab with the detail tab system.
        ui.page.locator('[data-ai-id="workload-detail:tab-trigger:revisions"]').click()
        table = ui.page.locator('[data-ai-id="deployments-detail:revisions"]')
        expect(table).to_be_visible(timeout=30_000)
        rows = table.locator("tbody tr")
        expect(rows).to_have_count(3)
        # Newest first, and only the current revision is marked.
        assert "当前" in rows.first.inner_text(), rows.first.inner_text()
        assert "nginx:1.29" in rows.first.inner_text()
        # Rolling back to the revision you are on would be a no-op, so it offers none.
        assert table.locator('button[data-ai-id^="deployments-detail:rollback-"]').count() == 2

        table.locator('[data-ai-id="deployments-detail:rollback-1"]').click()
        ui.page.locator('[data-ai-id="deployments:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="deployments:delete-confirm"]').click()
        ui.page.wait_for_timeout(5000)

        status, body = ui._request("GET", f"{DEPLOYMENTS}/{name}")
        assert status == 200
        image = body["spec"]["template"]["spec"]["containers"][0]["image"]
        # A rollback is a patch of the pod template back to the older revision's.
        assert image == first_image, image
        screenshot(ui.page, "deployment-revisions")
    finally:
        ui.delete_deployment(name)
