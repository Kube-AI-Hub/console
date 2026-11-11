from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_06(configmaps_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-06 名称列首行是别名，创建时间固定格式。"""

    configmaps_page.url = f"{ui_config.app}/kube-frontend/system-workspace/clusters/host/projects/kube-frontend-demo/configmaps"
    configmaps_page.open()
    configmaps_page.wait_ready()

    rows = configmaps_page.surface.locator("tr[data-ai-row]")
    expect(rows.first).to_be_visible()

    names = configmaps_page.row_names()
    assert names, "the list must have rows for this check"

    # The name cell is two stacked spans, so read them individually: `inner_text`
    # of the cell joins them without a separator.
    for name in names[:5]:
        cell = configmaps_page.surface.locator(f'tr[data-ai-row="{name}"] td').nth(1)
        spans = cell.locator("span")
        first = spans.nth(1).inner_text().strip()
        second = spans.nth(2).inner_text().strip()
        # Never "name (alias)": the alias replaces the name; the real name stays
        # reachable on the detail page and in the link's tooltip.
        assert "(" not in first, f"{name}: {first}"
        assert second, f"{name}: description line is missing"

    timestamps = configmaps_page.surface.locator("tr[data-ai-row] td").filter(has_text=TIMESTAMP)
    assert timestamps.count() > 0, "no cell matched YYYY-MM-DD HH:mm:ss"

    screenshot(configmaps_page.page, "list-name-and-time")
