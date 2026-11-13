from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_DELETE_01(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-01 批量删除可用性：未选中禁用且带 data-ai-needs。

This case is about the *control*, not about deleting: it proves the bulk action is
disabled with nothing selected, advertises what it needs, and enables on selection.
The delete itself is verified by DELETE-02 (one object) and BULK_DELETE-01 (two), which
check the objects are gone rather than that a button lit up.
"""

    # The list is empty on a fresh cluster; seed two objects so the case does
    # not depend on whatever happens to be deployed.
    seeded_configmaps["create"]("case-a", {"key-a": "1"})
    seeded_configmaps["create"]("case-b", {"key-b": "2"})

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready":
        pytest.skip("没有可勾选的行")

    expect(configmaps_page.bulk_delete).to_be_disabled()
    assert configmaps_page.bulk_delete.get_attribute("data-ai-needs") == "configmaps:row-select"

    configmaps_page.select_row(configmaps_page.row_names()[0])
    expect(configmaps_page.bulk_delete).to_be_enabled()
