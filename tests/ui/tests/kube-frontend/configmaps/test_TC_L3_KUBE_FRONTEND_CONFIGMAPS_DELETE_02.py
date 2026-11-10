from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_DELETE_02(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-DELETE-02 删除并刷新：确认后行消失。"""

    # The list is empty on a fresh cluster; seed two objects so the case does
    # not depend on whatever happens to be deployed.
    seeded_configmaps["create"]("case-a", {"key-a": "1"})
    seeded_configmaps["create"]("case-b", {"key-b": "2"})

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready":
        pytest.skip("没有可删除的行")

    target = configmaps_page.row_names()[0]
    configmaps_page.delete_row(target)

    # Typed-name confirmation, not a browser confirm: the reader must prove they
    # know which object is going away.
    configmaps_page.fill_dialog_field("configmaps:delete-input", target)
    configmaps_page.confirm_dialog("configmaps:delete-confirm")

    # Wait for the row to disappear rather than sampling once: the list refetches
    # after the delete, and a single read races that refetch.
    expect(configmaps_page.surface.locator(f'[data-ai-row="{target}"]')).to_have_count(0)
    assert target not in configmaps_page.row_names()
