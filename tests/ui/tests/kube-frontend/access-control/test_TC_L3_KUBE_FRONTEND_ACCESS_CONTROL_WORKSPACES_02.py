from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACES_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-02 企业空间：创建、编辑与删除。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-ws{int(time.time() * 1000) % 1_000_000}"
    try:
        ui.open("workspaces")
        ui.wait_ready("workspaces")
        ui.page.locator('[data-ai-id="workspaces:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()

        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-alias").fill("界面空间")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, body = ui.api.request("GET", f"{WORKSPACES}/{name}")
        assert status == 200, (status, body)
        assert ((body.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name") == "界面空间"

        # Edit: the name is the object's identity, so only the alias changes.
        ui.page.locator('[data-ai-id="workspaces:search"]').last.fill(name)
        ui.page.wait_for_timeout(1000)
        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        ui.page.get_by_role("menuitem", name="编辑企业空间", exact=True).click()
        edit = ui.page.get_by_role("dialog")
        expect(edit).to_be_visible()
        expect(edit.locator("#ai-field-name")).to_be_disabled()
        ui.page.locator("#ai-field-alias").fill("改后空间")
        edit.get_by_role("button", name="确认").click()
        expect(edit).to_have_count(0, timeout=20_000)

        status, body = ui.api.request("GET", f"{WORKSPACES}/{name}")
        assert status == 200
        assert ((body.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name") == "改后空间"

        # Delete and confirm it is gone from the collection.
        ui.page.locator('[data-ai-id="workspaces:search"]').last.fill(name)
        ui.page.wait_for_timeout(1000)
        ui.page.locator(f'[data-ai-row="{name}"] button[aria-label="更多操作"]').click()
        ui.page.get_by_role("menuitem", name="删除", exact=True).click()
        ui.page.locator('[data-ai-id="workspaces:delete-input"]').fill(name)
        ui.page.locator('[data-ai-id="workspaces:delete-confirm"]').click()
        ui.page.wait_for_timeout(3000)

        status, listed = ui.api.request("GET", f"{WORKSPACES}?limit=-1")
        assert status == 200
        assert [i["metadata"]["name"] for i in (listed.get("items") or []) if i["metadata"]["name"] == name] == []
        screenshot(ui.page, "access-workspaces-ops")
    finally:
        ui.api.request("DELETE", f"{WORKSPACES}/{name}")
