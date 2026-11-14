from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_SNAPSHOT_ALIAS_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOT_ALIAS-01 快照别名路由重定向。"""

    for suffix in ("snapshots", "snapshots/default"):
        page.goto(f"{ui_config.app}/kube-frontend/clusters/{ui_config.cluster}/{suffix}")
        expect(page).to_have_url(re.compile(r"/clusters/[^/]+/volume-snapshots/?$"), timeout=30_000)
        surface = page.locator('[data-ai-id="cluster-volume-snapshots:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)

    screenshot(page, "snapshot-alias")
