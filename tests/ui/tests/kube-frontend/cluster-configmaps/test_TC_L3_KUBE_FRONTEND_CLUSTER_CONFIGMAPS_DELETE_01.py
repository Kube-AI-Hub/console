from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_CONFIGMAPS_DELETE_01(cluster_configmaps_page, page, cluster_configmaps_edit_fixture, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01 删除按项目定位。"""
    project, name, other = cluster_configmaps_edit_fixture

    cluster_configmaps_page.open()
    cluster_configmaps_page.wait_ready()

    cluster_configmaps_page.delete_row(project, name)
    # The confirmation is typed-name style: the button is disabled until the field
    # holds exactly the name, and its label is 删除 (not 确定). Drive it by handle so
    # neither the label nor the role has to be guessed.
    dialog = page.get_by_role("dialog")
    expect(dialog.locator('[data-ai-id="configmaps:delete-input"]')).to_be_visible(timeout=20_000)
    dialog.locator('[data-ai-id="configmaps:delete-input"]').fill(name)
    dialog.locator('[data-ai-id="configmaps:delete-confirm"]').click()
    cluster_configmaps_page.wait_ready()

    # The same name in another project must survive: the delete is addressed by
    # (project, name), not by name alone. Wait for the row to actually go: the list has
    # to be re-queried after the delete, and reading it immediately reported the row
    # that was already on its way out.
    deadline = time.time() + 120
    while time.time() < deadline:
        keys = cluster_configmaps_page.row_keys
        if f"{project}/{name}" not in keys:
            break
        time.sleep(1)
    else:
        raise AssertionError(f"row {project}/{name} was still listed after the delete: {keys}")

    keys = cluster_configmaps_page.row_keys
    assert f"{project}/{name}" not in keys, keys
    assert f"{other}/{name}" in keys, keys

    screenshot(page, "cluster-delete")