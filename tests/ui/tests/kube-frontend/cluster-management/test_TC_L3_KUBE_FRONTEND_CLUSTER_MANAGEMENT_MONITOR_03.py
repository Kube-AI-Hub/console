from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER = "host"

# Every card the cluster monitor must show: the physical-resource set the old console drew.
CARDS = [
    "cpu",
    "memory",
    "pods",
    "pods-abnormal",
    "pods-succeeded",
    "nodes",
    "load1",
    "load5",
    "load15",
    "disk",
    "inode",
    "net-tx",
    "net-rx",
]

PERCENT = ["cpu", "memory", "disk", "inode"]
DECIMAL = ["load1", "load5", "load15"]
RATE = ["net-tx", "net-rx"]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-03 集群监控：物理资源指标。"""

    ui = cluster_management_page
    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/clusters/{CLUSTER}/monitor")
    surface = ui.page.locator('[data-ai-id="cluster-monitor:surface"]')
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # Every card renders, with a value or an explicit empty state (never a silent 0).
    for key in CARDS:
        card = ui.page.locator(f'[data-ai-id="cluster-monitor:{key}"]')
        expect(card).to_be_visible(timeout=30_000)
        has_value = card.locator(f'[data-ai-id="cluster-monitor:{key}:latest"]').count() == 1
        has_empty = card.locator(f'[data-ai-id="cluster-monitor:{key}:empty"]').count() == 1
        assert has_value or has_empty, key

    def latest(key: str) -> str:
        return ui.page.locator(f'[data-ai-id="cluster-monitor:{key}:latest"]').inner_text().strip()

    for key in PERCENT:
        value = latest(key)
        if value == "-":
            continue
        match = re.fullmatch(r"(\d+)%", value)
        assert match, (key, value)
        assert 0 <= int(match.group(1)) <= 100, (key, value)

    for key in DECIMAL:
        value = latest(key)
        if value == "-":
            continue
        assert re.fullmatch(r"\d+\.\d{2}", value), (key, value)

    for key in RATE:
        value = latest(key)
        if value == "-":
            continue
        assert re.fullmatch(r"[\d.]+\s?(B|KiB|MiB|GiB|TiB)/s", value), (key, value)

    screenshot(ui.page, "cluster-monitor-physical")
