from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_06(configmaps_page, ui_config, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-06 名称列首行是别名，创建时间固定格式。"""

    # Seed into the project the page opens on, instead of depending on a project that
    # only exists on one cluster (`kube-frontend-demo`) and on whatever it happens to
    # contain. The alias is seeded too, so the "first line is the alias" rule is checked
    # against a known object rather than luck.
    project = "default"
    name = seeded_configmaps["create"]("case-a", {"key-a": "1"}, {"kubesphere.io/alias-name": "别名对象"})
    configmaps_page.url = f"{ui_config.app}/kube-frontend/system-workspace/clusters/host/projects/{project}/configmaps"
    configmaps_page.open()
    configmaps_page.wait_ready()

    configmaps_page.search(name)
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
    # The seeded object carries an alias, so its first line must be that alias.
    alias_cell = configmaps_page.surface.locator(f'tr[data-ai-row="{name}"] td').nth(1)
    assert alias_cell.locator("span").nth(1).inner_text().strip() == "别名对象"

    timestamps = configmaps_page.surface.locator("tr[data-ai-row] td").filter(has_text=TIMESTAMP)
    assert timestamps.count() > 0, "no cell matched YYYY-MM-DD HH:mm:ss"

    screenshot(configmaps_page.page, "list-name-and-time")
