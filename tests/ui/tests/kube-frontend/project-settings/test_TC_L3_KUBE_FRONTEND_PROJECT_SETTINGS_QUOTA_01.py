from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

QUOTAS = "/api/v1/namespaces/default/resourcequotas"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_QUOTA_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-QUOTA-01 项目配额：编辑写入 ResourceQuota。"""

    ui = project_settings_page
    assert ui.api is not None

    # Start from a known state: whatever quota the project had, the case creates or
    # reuses one object and removes it afterwards.
    status, before = ui.api.request("GET", f"{QUOTAS}?limit=-1")
    existing = [item["metadata"]["name"] for item in (before.get("items") or [])] if status == 200 else []
    created_name = existing[0] if existing else "default-quota"
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/default/baseinfo")
        surface = ui.page.locator('[data-ai-id="project-info:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="project-info:edit-quota"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()

        # A quantity the apiserver would reject must be stopped here.
        ui.page.locator("#ai-field-requests_cpu").fill("abc")
        dialog.get_by_role("button", name="确认").click()
        ui.page.wait_for_timeout(600)
        expect(dialog).to_be_visible()
        assert "数量" in dialog.inner_text()

        ui.page.locator("#ai-field-requests_cpu").fill("2")
        ui.page.locator("#ai-field-requests_memory").fill("4Gi")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=20_000)

        status, body = ui.api.request("GET", f"{QUOTAS}/{created_name}")
        assert status == 200, (status, body)
        hard = ((body.get("spec") or {}).get("hard")) or {}
        assert hard.get("requests.cpu") == "2", hard
        assert hard.get("requests.memory") == "4Gi", hard
        # Empty fields must not become keys: a missing key means "unlimited", while a
        # stored empty quantity is rejected outright.
        assert "" not in hard.values(), hard
        screenshot(ui.page, "project-quota")
    finally:
        # Leave the project as it was found.
        if not existing:
            ui.api.request("DELETE", f"{QUOTAS}/{created_name}")
        elif status == 200:
            ui.api.request(
                "PATCH",
                f"{QUOTAS}/{created_name}",
                {"spec": {"hard": ((before["items"][0].get("spec") or {}).get("hard")) or None}},
            )
