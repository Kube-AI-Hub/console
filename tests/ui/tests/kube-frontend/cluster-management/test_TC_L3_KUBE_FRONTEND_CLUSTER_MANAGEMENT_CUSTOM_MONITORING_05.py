from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

COLLECTION = "/apis/monitoring.kubesphere.io/v1alpha2/clusterdashboards"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CUSTOM_MONITORING_05(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-05 创建仪表板与编辑信息。"""

    ui = cluster_management_page
    assert ui.api is not None

    slug = f"tc-dash-{uuid.uuid4().hex[:8]}"
    title = f"探针仪表板 {slug}"
    renamed = f"{title} 改名"

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/custom-monitoring")
    surface = ui.page.locator('[data-ai-id="custom-monitoring:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    try:
        # ---- create ----
        create = ui.page.locator('[data-ai-id="custom-monitoring:create"]')
        expect(create).to_be_visible(timeout=30_000)
        create.click()
        dialog = ui.page.locator('[data-ai-id="dashboard-info:surface"]')
        expect(dialog).to_be_visible(timeout=20_000)

        ui.page.locator('[data-ai-id="dashboard-info:title"]').fill(title)
        # The name follows the title's slug until it is typed explicitly.
        name_input = ui.page.locator('[data-ai-id="dashboard-info:name"]')
        expect(name_input).not_to_have_value("", timeout=10_000)
        name_input.fill(slug)
        ui.page.locator('[data-ai-id="dashboard-info:submit"]').click()

        row = ui.page.locator(f'[data-ai-row="{slug}"]')
        expect(row).to_be_visible(timeout=30_000)

        status, created = ui.api.request("GET", f"{COLLECTION}/{slug}")
        assert status == 200, (status, created)
        spec = (created or {}).get("spec") or {}
        assert spec.get("title") == title, spec
        # panels is written explicitly so the key exists for whoever edits the YAML next.
        assert spec.get("panels") == [], spec

        # ---- edit information: the name is locked, panels are preserved ----
        row.locator("button").last.click()
        ui.page.locator('[data-ai-id="custom-monitoring:edit"]').click()
        expect(dialog).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="dashboard-info:name"]')).to_be_disabled()
        ui.page.locator('[data-ai-id="dashboard-info:title"]').fill(renamed)
        ui.page.locator('[data-ai-id="dashboard-info:submit"]').click()
        expect(row).to_contain_text(renamed, timeout=30_000)

        status, updated = ui.api.request("GET", f"{COLLECTION}/{slug}")
        assert status == 200, (status, updated)
        updated_spec = (updated or {}).get("spec") or {}
        assert updated_spec.get("title") == renamed, updated_spec
        # A merge patch on spec.title must not disturb the panels key.
        assert "panels" in updated_spec, updated_spec

        screenshot(ui.page, "custom-monitoring-create")
    finally:
        ui.api.request("DELETE", f"{COLLECTION}/{slug}")
