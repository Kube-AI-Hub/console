from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

from pages.federated_page import FederatedProjectsPageObject

pytestmark = pytest.mark.ui


def _workspace(fed: FederatedProjectsPageObject) -> str:
    for item in fed.project_names():
        template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
        if template.get("kubesphere.io/workspace"):
            return str(template["kubesphere.io/workspace"])
    known = fed.workspaces()
    assert known, "no workspace is visible to this account"
    return "system-workspace" if "system-workspace" in known else known[0]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_06(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06 联邦项目单条与批量删除。"""

    ui = access_control_page
    assert ui.api is not None
    fed = FederatedProjectsPageObject(ui.page, ui.base_url, api=ui.api)
    workspace = _workspace(fed)
    prefix = f"pwfed{uuid.uuid4().hex[:6]}"
    names = [f"{prefix}-a", f"{prefix}-b", f"{prefix}-c"]
    created: list[str] = []

    try:
        for name in names:
            fed.create_project(workspace=workspace, name=name)
            created.append(name)
        assert {item.get("metadata", {}).get("name") for item in fed.project_names()} >= set(names)

        # --- Single delete from the row actions. ---
        fed.open_list(workspace)
        fed.search(prefix)
        expect(fed.row(names[0])).to_be_visible(timeout=60_000)
        fed.open_row_action(names[0], "federated-projects:delete")

        dialog = fed.create_dialog()
        expect(dialog).to_be_visible(timeout=20_000)
        expect(dialog).to_contain_text("删除联邦项目")
        fed.confirm_delete(names[0])

        deadline = time.time() + 120
        while time.time() < deadline and fed.find_project(names[0]) is not None:
            time.sleep(2)
        assert fed.find_project(names[0]) is None, f"{names[0]} was not deleted"
        created.remove(names[0])

        # --- Bulk delete: select both remaining rows, confirm the count. ---
        fed.search(prefix)
        for name in names[1:]:
            expect(fed.row(name)).to_be_visible(timeout=60_000)
            ui.page.locator(f'[data-ai-id="federated-projects:select:{name}"]').first.check()
        expect(ui.page.locator('[data-ai-id="federated-projects:bulk-delete"]').first).to_be_enabled()
        fed.list_delete(names[1:])

        deadline = time.time() + 120
        while time.time() < deadline and any(fed.find_project(name) for name in names[1:]):
            time.sleep(2)
        for name in names[1:]:
            assert fed.find_project(name) is None, f"{name} was not deleted in the batch"
            created.remove(name)

        ui.page.locator('[data-ai-id="federated-projects:refresh"]').first.click()
        fed.wait_ready()
        expect(fed.surface().locator("tbody tr[data-ai-row]").filter(has_text=prefix)).to_have_count(0)
        screenshot(ui.page, "federated-projects-delete")
    finally:
        for name in list(created):
            fed.delete_project(name)
        assert all(fed.find_project(name) is None for name in names)
