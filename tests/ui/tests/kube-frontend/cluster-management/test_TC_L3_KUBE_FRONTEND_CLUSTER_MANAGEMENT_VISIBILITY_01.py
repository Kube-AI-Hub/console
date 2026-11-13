from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER = "/apis/cluster.kubesphere.io/v1alpha1/clusters/host"
VISIBILITY_LABEL = "cluster.kubesphere.io/visibility"
WORKSPACE_LABEL = "kubesphere.io/workspace"


def _cluster(api) -> dict | None:
    status, body = api.request("GET", CLUSTER)
    return body if status == 200 and isinstance(body, dict) else None


def _labels(api) -> dict:
    return ((_cluster(api) or {}).get("metadata") or {}).get("labels") or {}


def _patch(api, visibility: str) -> int:
    status, _ = api.request(
        "PATCH",
        CLUSTER,
        {"metadata": {"labels": {VISIBILITY_LABEL: visibility}}},
        "application/merge-patch+json",
    )
    return status


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_VISIBILITY_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01 集群可见性：公开/私有标签读写。"""

    ui = cluster_management_page
    assert ui.api is not None

    original = _labels(ui.api).get(VISIBILITY_LABEL)
    original = "public" if original == "public" else "private"
    workspace_before = _labels(ui.api).get(WORKSPACE_LABEL)

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/host/visibility")
        surface = ui.page.locator('[data-ai-id="cluster-visibility:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        assert surface.get_attribute("data-ai-state") == "ready"

        panel = ui.page.locator('[data-ai-id="cluster-visibility:panel"]')
        expected_label = "公开" if original == "public" else "私有"
        assert expected_label in panel.inner_text(), panel.inner_text()[:200]

        target = "private" if original == "public" else "public"
        ui.page.locator(f'[data-ai-id="cluster-visibility:{target}"]').click()

        # The label is the fact; the badge is only how it is drawn.
        deadline_wait = 30
        for _ in range(deadline_wait):
            if _labels(ui.api).get(VISIBILITY_LABEL) == target:
                break
            ui.page.wait_for_timeout(1000)
        assert _labels(ui.api).get(VISIBILITY_LABEL) == target, _labels(ui.api)
        # A merge patch on one label must not touch the workspace label, which is the
        # cluster's only link to its enterprise space.
        assert _labels(ui.api).get(WORKSPACE_LABEL) == workspace_before, _labels(ui.api)
        target_label = "公开" if target == "public" else "私有"
        expect(panel).to_contain_text(target_label, timeout=20_000)

        screenshot(ui.page, "cluster-visibility")
    finally:
        # The cluster belongs to the installation, not to this run.
        _patch(ui.api, original)
        assert _labels(ui.api).get(VISIBILITY_LABEL) == original
