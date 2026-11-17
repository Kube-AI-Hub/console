from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_SWITCH_03(cluster_fleet_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-03 切换弹窗：搜索与刷新同一行。"""

    ui = cluster_fleet_page
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui_config.cluster}/overview")
    expect(ui.page.locator('[data-ai-id="overview:surface"]').last).to_be_visible(timeout=30_000)

    dialog = ui.open_switcher()
    search = ui.switcher_search(dialog)
    refresh = ui.switcher_refresh(dialog)
    expect(search).to_be_visible(timeout=20_000)
    expect(refresh).to_be_visible()

    search_box = search.bounding_box()
    refresh_box = refresh.bounding_box()
    assert search_box and refresh_box
    # Same row: the refresh used to sit on a line of its own under the field.
    assert abs(search_box["y"] - refresh_box["y"]) < 1, (search_box, refresh_box)
    assert abs(search_box["height"] - refresh_box["height"]) < 1, (search_box, refresh_box)
    # Immediately to its right, not pushed to the far edge of the dialog.
    gap = refresh_box["x"] - (search_box["x"] + search_box["width"])
    assert 0 < gap <= 16, gap
    # And the pair ends where the list ends, so the row reads as one toolbar.
    rows = ui.switcher_rows(dialog)
    expect(rows.first).to_be_visible(timeout=20_000)
    list_box = rows.first.bounding_box()
    assert list_box
    assert abs((refresh_box["x"] + refresh_box["width"]) - (list_box["x"] + list_box["width"])) <= 2, (
        refresh_box, list_box)

    # A refresh control with no accessible name is unusable from the keyboard.
    expect(refresh).to_have_attribute("aria-label", "刷新")
    screenshot(ui.page, "cluster-switch-toolbar")
