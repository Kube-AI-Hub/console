from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_LIST_05(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-05 集群列表按 host/成员筛选。"""

    ui = cluster_management_page
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    surface = ui.page.locator('[data-ai-id="clusters:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    rows = ui.page.locator('[data-ai-row]')
    total = rows.count()
    assert total >= 1

    def names() -> list[str]:
        return [rows.nth(i).get_attribute("data-ai-row") or "" for i in range(rows.count())]

    host_rows = [n for n in names() if n == ui.cluster]
    assert host_rows, (ui.cluster, names())

    picker = ui.page.locator('[data-ai-id="clusters:filter:type"]')
    expect(picker).to_be_visible(timeout=20_000)

    # Host: only the host cluster remains.
    picker.click()
    ui.page.get_by_role("option", name="主集群", exact=True).click()
    expect(rows).to_have_count(1, timeout=20_000)
    assert names() == [ui.cluster], names()

    # Member: the host cluster is gone. The fleet may legitimately contain member clusters
    # (a case that creates one and fails before cleanup leaves it behind), so the assertion is
    # about absence, not about an empty list.
    picker.click()
    ui.page.get_by_role("option", name="成员集群", exact=True).click()
    expect(ui.page.locator(f'[data-ai-row="{ui.cluster}"]')).to_have_count(0, timeout=20_000)
    assert ui.cluster not in names()

    # Clearing the filter restores the full list and the host cluster stays first.
    picker.click()
    ui.page.get_by_role("option", name="全部集群类型", exact=True).click()
    expect(rows).to_have_count(total, timeout=20_000)
    assert names()[0] == ui.cluster, names()

    screenshot(ui.page, "clusters-type-filter")
