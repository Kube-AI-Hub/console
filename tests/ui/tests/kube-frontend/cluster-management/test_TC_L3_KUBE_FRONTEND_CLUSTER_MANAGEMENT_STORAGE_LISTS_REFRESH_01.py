from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER = "host"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_STORAGE_LISTS_REFRESH_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-STORAGE_LISTS_REFRESH-01 集群存储列表刷新。"""

    ui = cluster_management_page
    origin = ui.base_url.split("/kube-frontend/")[0]

    pages = [
        ("storageclasses", f"{origin}/kube-frontend/clusters/{CLUSTER}/storageclasses"),
        ("persistentvolumes", f"{origin}/kube-frontend/clusters/{CLUSTER}/persistentvolumes"),
        (
            "cluster-persistentvolumeclaims",
            f"{origin}/kube-frontend/clusters/{CLUSTER}/persistentvolumeclaims",
        ),
        ("cluster-volume-snapshots", f"{origin}/kube-frontend/clusters/{CLUSTER}/volume-snapshots"),
        ("cluster-snapshot-classes", f"{origin}/kube-frontend/clusters/{CLUSTER}/volume-snapshot-classes"),
    ]
    for handle, url in pages:
        ui.page.goto(url)
        button = ui.page.locator(f'[data-ai-id="{handle}:refresh"]')
        expect(button).to_be_visible(timeout=60_000)
        # A disabled button is the fingerprint of a schema memo that never sees the query settle.
        expect(button).to_be_enabled(timeout=60_000)

    # Clicking refresh re-issues the persistent volume list request.
    ui.page.goto(f"{origin}/kube-frontend/clusters/{CLUSTER}/persistentvolumes")
    refresh = ui.page.locator('[data-ai-id="persistentvolumes:refresh"]')
    expect(refresh).to_be_enabled(timeout=60_000)
    with ui.page.expect_request(
        lambda request: "persistentvolumes" in request.url and request.method == "GET", timeout=30_000
    ):
        refresh.click()
    screenshot(ui.page, "cluster-storage-lists-refresh")
