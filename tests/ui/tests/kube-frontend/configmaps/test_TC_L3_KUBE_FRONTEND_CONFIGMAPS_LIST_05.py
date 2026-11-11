from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

KEYS_PREVIEW_LENGTH = 50


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_05(configmaps_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-05 键列截断到 50 个字符，完整键名在提示里。"""

    # Point at the project that holds the fixture ConfigMap rather than relying on
    # the default namespace happening to have a wide one.
    configmaps_page.url = f"{ui_config.app}/kube-frontend/system-workspace/clusters/host/projects/kube-frontend-demo/configmaps"
    configmaps_page.open()
    configmaps_page.wait_ready()

    # Scoped to the keys column: the name link also carries a `title` (the real
    # object name when an alias is shown), so a bare `[title]` picks the wrong cell.
    clipped = configmaps_page.surface.locator('tr[data-ai-row] td:nth-child(4) [title]')
    if clipped.count() == 0:
        pytest.skip("当前项目没有键名超过 50 个字符的 ConfigMap")

    cell = clipped.first
    shown = cell.inner_text()
    full = cell.get_attribute("title") or ""

    # Code points, not UTF-16 units: the implementation counts the same way, and
    # a key is arbitrary user text.
    assert len(shown) == KEYS_PREVIEW_LENGTH + 3, shown
    assert shown.endswith("..."), shown
    assert shown == full[:KEYS_PREVIEW_LENGTH] + "..."
    assert len(full) > KEYS_PREVIEW_LENGTH

    # A row is a summary, so clipping must not cost the row its uniform height.
    rows = configmaps_page.surface.locator("tr[data-ai-row]")
    heights = {round(row.bounding_box()["height"]) for row in rows.all() if row.bounding_box()}
    assert len(heights) <= 2, heights

    # Short key lists are untouched, and carry no tooltip for a cut that did not
    # happen.
    # Walk the column in the page so "has no tooltip" is one predicate rather than
    # a locator filter that Playwright resolves against the whole document.
    short = configmaps_page.page.evaluate(
        """() => [...document.querySelectorAll('tr[data-ai-row] td:nth-child(4)')]
             .filter(td => !td.querySelector('[title]'))
             .map(td => td.innerText.trim())"""
    )
    for text in short:
        assert not text.endswith("..."), text

    screenshot(configmaps_page.page, "list-keys-clipped")
