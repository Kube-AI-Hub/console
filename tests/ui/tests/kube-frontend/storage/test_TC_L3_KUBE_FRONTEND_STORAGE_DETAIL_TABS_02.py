from __future__ import annotations

import time
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SNAPSHOTS = "/apis/snapshot.storage.k8s.io/v1/namespaces/default/volumesnapshots"


def _create(ui, name: str) -> str:
    """Create a VolumeSnapshot of a claim that does not exist.

    The object is what the detail page reads; whether the driver ever fills in content is
    the cluster's business (this deployment has no snapshotter, so it stays not-ready —
    which is exactly the state whose reason lives in the events tab).
    """
    body = {
        "apiVersion": "snapshot.storage.k8s.io/v1",
        "kind": "VolumeSnapshot",
        "metadata": {"name": name, "namespace": "default"},
        "spec": {"source": {"persistentVolumeClaimName": "tc-e2e-missing-claim"}},
    }
    status, payload = ui.api.request("POST", SNAPSHOTS, body)
    assert status in (200, 201), f"创建快照 {name} 失败：{status} {repr(payload)[:200]}"
    return name


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_DETAIL_TABS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02 快照详情：数据来源与事件页签。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, _ = ui.api.request("GET", SNAPSHOTS)
    if status != 200:
        pytest.skip("本集群没有快照 CRD，无法验证快照详情")

    name = f"tc-e2e-snap-{int(time.time()) % 100000}"
    _create(ui, name)
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/volumesnapshots/{name}")
        surface = ui.page.locator('[data-ai-id="volumesnapshots-detail:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        source_tab = ui.page.locator('[data-ai-id="volumesnapshots-detail:tab:source"]')
        events_tab = ui.page.locator('[data-ai-id="volumesnapshots-detail:tab:events"]')
        expect(source_tab).to_be_visible(timeout=30_000)
        expect(events_tab).to_be_visible(timeout=30_000)
        # Default tab is 数据来源, and the attributes live there.
        expect(ui.page.locator('[data-ai-id="volumesnapshots-detail:attributes"]')).to_be_visible()

        events_tab.click()
        # Either the event table or the explicit empty state — never a blank panel. Wait for
        # one of them: the events query is in flight right after the tab opens.
        # The events panel renders either the table (handle `storage-detail:events`) or the
        # empty sentence (`storage-detail:events-empty`); rows carry no `data-ai-row`.
        settled = ui.page.locator('[data-ai-id="storage-detail:events"], [data-ai-id="storage-detail:events-empty"]').first
        expect(settled).to_be_visible(timeout=30_000)
        panel_text = settled.inner_text()
        assert "原因" in panel_text or "还没有事件" in panel_text, panel_text[:300]
        screenshot(ui.page, "snapshot-detail-events")

        source_tab.click()
        expect(ui.page.locator('[data-ai-id="volumesnapshots-detail:attributes"]')).to_be_visible(timeout=20_000)
    finally:
        ui.api.request("DELETE", f"{SNAPSHOTS}/{quote(name)}")