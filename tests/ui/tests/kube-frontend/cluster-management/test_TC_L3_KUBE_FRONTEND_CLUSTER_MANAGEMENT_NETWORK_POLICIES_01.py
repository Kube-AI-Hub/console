from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NETWORK_POLICIES_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NETWORK_POLICIES-01 跨项目网络策略。"""

    cluster = ui_config.cluster
    page.goto(f"{ui_config.app}/kube-frontend/clusters/{cluster}/networkpolicies")
    surface = page.locator('[data-ai-id="cluster-networkpolicies:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-ai-id="cluster-networkpolicies:surface"]');
            return el && el.getAttribute('data-ai-state') !== 'loading';
        }""",
        timeout=60_000,
    )

    state = surface.get_attribute("data-ai-state")
    assert state in ("ready", "empty"), f"网络策略页进入了 {state} 状态"

    body = surface.inner_text()
    if state == "empty":
        # The empty state has to say where policies are created, otherwise it reads as "this
        # cluster has no network isolation at all".
        assert "网络隔离" in body or "项目" in body, body[:200]
        screenshot(page, "cluster-networkpolicies-empty")
        return

    rows = page.locator('[data-ai-id="cluster-networkpolicies:surface"] [data-ai-row]')
    assert rows.count() > 0
    link = rows.first.locator("a").first
    href = link.get_attribute("href") or ""
    # The row links into the owning project, which needs its workspace segment in the URL.
    assert re.search(r"/kube-frontend/[^/]+/clusters/[^/]+/projects/[^/]+/settings/network", href), href
    screenshot(page, "cluster-networkpolicies")
