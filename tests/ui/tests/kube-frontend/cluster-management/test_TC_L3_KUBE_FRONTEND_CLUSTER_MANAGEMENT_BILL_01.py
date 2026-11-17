from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

EXPECTED_ITEMS = {
    "logs": "/clusters/host/logs",
    "events": "/clusters/host/events",
    "audit": "/clusters/host/audit-logs",
    "bill": "/clusters/host/bill",
    "kubeconfig": "/clusters/host/overview",
    "kubectl": "/clusters/host/kubectl",
}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_BILL_01(workbench_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01 工具箱与资源消费页。"""

    ui = workbench_page
    page = ui.page
    page.goto(f'{ui.base_url}/kube-frontend/', wait_until="domcontentloaded")

    ball = page.locator('[data-ai-id="toolbox:ball"]')
    expect(ball).to_be_visible(timeout=60_000)
    ball.click()
    panel = page.locator('[data-ai-id="toolbox:panel"]')
    expect(panel).to_be_visible(timeout=20_000)
    for key, suffix in EXPECTED_ITEMS.items():
        href = page.locator(f'[data-ai-id="toolbox:item:{key}"]').get_attribute("href")
        assert href is not None and suffix in href, (key, href)
    screenshot(page, "toolbox-open")

    page.locator('[data-ai-id="toolbox:item:bill"]').click()
    page.wait_for_url("**/clusters/host/bill", timeout=30_000)

    surface = page.locator('[data-ai-id="cluster-bill:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    table = page.locator('[data-ai-id="cluster-bill:table"]')
    expect(table).to_be_visible(timeout=30_000)
    headers = page.locator('[data-ai-id="cluster-bill:table"] thead th').all_inner_texts()
    assert headers == ["项目", "CPU（核）", "内存", "存储卷", "GPU（卡）"], headers
    rows = page.locator('[data-ai-id^="cluster-bill:row:"]')
    assert rows.count() > 0, "metering is enabled on B200; the table must not be empty"
    screenshot(page, "bill-1h")

    page.locator('[data-ai-id="cluster-bill:range:6h"]').click()
    expect(table).to_be_visible(timeout=30_000)
    expect(page.locator('[data-ai-id="cluster-bill:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # Drag: put the ball 120px further from the bottom-right corner, then reload.
    page.goto(f'{ui.base_url}/kube-frontend/', wait_until="domcontentloaded")
    ball = page.locator('[data-ai-id="toolbox:ball"]')
    expect(ball).to_be_visible(timeout=30_000)
    before = ball.evaluate("el => getComputedStyle(el.parentElement).right")
    box = ball.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 - 120, box["y"] + box["height"] / 2 - 80, steps=10)
    page.mouse.up()
    stored = page.evaluate("localStorage.getItem('kube-frontend:toolbox')")
    assert stored is not None, "drag position must persist"
    page.reload(wait_until="domcontentloaded")
    ball = page.locator('[data-ai-id="toolbox:ball"]')
    expect(ball).to_be_visible(timeout=30_000)
    after = ball.evaluate("el => getComputedStyle(el.parentElement).right")
    assert before != after, (before, after)
    screenshot(page, "toolbox-dragged")
