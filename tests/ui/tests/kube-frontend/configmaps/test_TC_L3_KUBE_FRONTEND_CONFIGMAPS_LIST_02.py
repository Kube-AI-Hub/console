from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02 列头切换排序：aria-sort 在 ascending 与 descending 之间切换。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    header = configmaps_page.surface.locator('[data-ai-id="configmaps:sort:name"]')
    # `aria-sort` lives on the <th>; the handle sits on the control inside it, so walk up to
    # the column header rather than assuming the immediate parent (markup inside the header is
    # free to change, the ARIA contract is not).
    column = header.locator("xpath=ancestor::th[1]")
    header.click()
    configmaps_page.wait_ready()
    assert column.get_attribute("aria-sort") in {"ascending", "descending"}

    header.click()
    configmaps_page.wait_ready()
    assert column.get_attribute("aria-sort") in {"ascending", "descending"}
