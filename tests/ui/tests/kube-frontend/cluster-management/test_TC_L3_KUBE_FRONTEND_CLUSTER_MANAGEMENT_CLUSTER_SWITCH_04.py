from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/apis/cluster.kubesphere.io/v1alpha1/clusters"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_SWITCH_04(cluster_fleet_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-04 别名在整页刷新后保持。"""

    ui = cluster_fleet_page
    assert ui.api is not None
    cluster = ui_config.cluster
    alias = "别名保持用例"
    status, body = ui.api.request("GET", f"{CLUSTERS}/{cluster}")
    assert status == 200 and isinstance(body, dict), status
    existing = (body.get("metadata") or {}).get("annotations") or {}
    original = existing.get("kubesphere.io/alias-name")
    patched, _ = ui.api.request(
        "PATCH", f"{CLUSTERS}/{cluster}", {"metadata": {"annotations": {"kubesphere.io/alias-name": alias}}})
    assert patched in (200, 201), patched

    def restore() -> None:
        if original is None:
            ui.api.request("PATCH", f"{CLUSTERS}/{cluster}",
                           {"metadata": {"annotations": {"kubesphere.io/alias-name": None}}})
        else:
            ui.api.request("PATCH", f"{CLUSTERS}/{cluster}",
                           {"metadata": {"annotations": {"kubesphere.io/alias-name": original}}})

    try:
        url = f"{ui.base_url}/kube-frontend/clusters/{cluster}/overview"
        ui.page.goto(url)
        switcher = ui.page.locator('[data-ai-id="shell:cluster-switcher"]').first
        expect(switcher).to_contain_text(alias, timeout=30_000)
        before = switcher.inner_text()

        # The bug: the cluster list was only fetched when the dialog opened, so a reload
        # showed the raw object name for a cluster the reader knows by its alias.
        ui.page.reload()
        expect(switcher).to_contain_text(alias, timeout=30_000)
        after = switcher.inner_text()
        assert before == after, (before, after)
        # The object name still sits under the alias: the two must not be confused.
        assert cluster in after, after
        screenshot(ui.page, "cluster-switch-alias-reload")

        # An alias that is removed must not survive as a stale label.
        ui.api.request("PATCH", f"{CLUSTERS}/{cluster}",
                       {"metadata": {"annotations": {"kubesphere.io/alias-name": None}}})
        ui.page.reload()
        expect(switcher).to_contain_text(cluster, timeout=30_000)
        expect(switcher).not_to_contain_text(alias, timeout=10_000)
    finally:
        restore()
