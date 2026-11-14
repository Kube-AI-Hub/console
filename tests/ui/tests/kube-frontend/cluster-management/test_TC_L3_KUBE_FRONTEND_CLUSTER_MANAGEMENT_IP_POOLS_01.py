from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_IP_POOLS_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-IP_POOLS-01 集群 IP 池：列表用量与详情。"""

    cluster = ui_config.cluster
    page.goto(f"{ui_config.app}/kube-frontend/clusters/{cluster}/ippools")
    surface = page.locator('[data-ai-id="ip-pools:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    # `empty` is a valid outcome: this cluster has no pools, and the page must say why rather
    # than look like a failed load.
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-ai-id="ip-pools:surface"]');
            return el && el.getAttribute('data-ai-state') !== 'loading';
        }""",
        timeout=60_000,
    )

    state = surface.get_attribute("data-ai-state")
    assert state in ("ready", "empty"), f"IP 池页进入了 {state} 状态"

    if state == "empty":
        body = surface.inner_text()
        assert "IP 池" in body
        # The empty state must explain the consequence, not just say "no data".
        assert "节点网络" in body or "没有" in body, body[:200]
        screenshot(page, "ip-pools-empty")
        return

    rows = page.locator('[data-ai-id="ip-pools:surface"] [data-ai-row]')
    assert rows.count() > 0
    first = rows.first
    # 已用 IP 不能是 `0 / 0`：容量未知时页面只显示已用或 `-`。
    assert "0 / 0" not in first.inner_text()
    first.locator("a").first.click()
    expect(page.locator('[data-ai-id="ip-pool-detail:surface"]')).to_be_visible(timeout=30_000)
    expect(page.locator('[data-ai-id="ip-pool-detail:basic"]')).to_be_visible()
    screenshot(page, "ip-pool-detail")
