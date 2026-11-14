from __future__ import annotations

import pytest
from playwright.sync_api import expect

from helpers.api import ApiClient

pytestmark = pytest.mark.ui

CONTENTS = "/apis/snapshot.storage.k8s.io/v1/volumesnapshotcontents"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_SNAPSHOT_CONTENT_01(page, ui_config, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_CONTENT-01 快照内容只读详情。"""

    api = ApiClient(ui_config.app, session_token)
    status, body = api.request("GET", CONTENTS)
    items = (body.get("items") or []) if status == 200 and isinstance(body, dict) else []
    origin = ui_config.app

    if items:
        name = items[0]["metadata"]["name"]
        spec = items[0].get("spec") or {}
        page.goto(f"{origin}/kube-frontend/clusters/{ui_config.cluster}/volume-snapshot-content/{name}")
        surface = page.locator('[data-ai-id="snapshot-content:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        basic = page.locator('[data-ai-id="snapshot-content:basic"]')
        expect(basic).to_be_visible(timeout=30_000)
        text = basic.inner_text()
        if spec.get("snapshotHandle"):
            assert str(spec["snapshotHandle"]) in text, text
        screenshot(page, "snapshot-content")
        return

    # No snapshot content exists in this cluster: a missing name must still be explained
    # instead of rendering an empty shell.
    page.goto(f"{origin}/kube-frontend/clusters/{ui_config.cluster}/volume-snapshot-content/tc-e2e-absent-content")
    surface = page.locator('[data-ai-id="snapshot-content:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).to_have_attribute("data-ai-state", "error", timeout=60_000)
    screenshot(page, "snapshot-content-missing")
