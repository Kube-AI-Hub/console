from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_AI_SURFACE_02(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02 句柄唯一：data-ai-id 在页面内不重复。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    ids = configmaps_page.ai_ids()
    assert ids, "页面没有发布任何 data-ai-id"
    duplicates = {value for value in ids if ids.count(value) > 1}
    assert duplicates == set(), f"重复的句柄：{duplicates}"

    assert configmaps_page.bulk_delete.get_attribute("data-ai-needs") == "configmaps:row-select"
