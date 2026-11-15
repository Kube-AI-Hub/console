from __future__ import annotations

import urllib.parse

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

ALERTS = "/kapis/alerting.kubesphere.io/v2beta1/globalalerts"


def _row_count(page) -> int:
    return page.locator("[data-ai-row]").count()


def _pick_option(page, filter_ai_id: str, label: str) -> None:
    page.locator(f'[data-ai-id="{filter_ai_id}"]').click()
    option = page.locator('[role="option"]', has_text=label).first
    expect(option).to_be_visible(timeout=20_000)
    option.click()


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_ALERTING_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-02 告警消息筛选。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{ALERTS}?limit=5&page=1")
    if status != 200 or not isinstance(body, dict) or not (body.get("items") or []):
        pytest.skip("集群没有告警消息，无法验证筛选")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/alerting-messages")
    surface = ui.page.locator('[data-ai-id="cluster-alerting-messages:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    unfiltered = _row_count(ui.page)
    assert unfiltered > 0, "未筛选时应至少有一行"

    # ---- state filter: server-side ----
    requests: list[str] = []
    def remember(url: str) -> None:
        # The query string arrives percent-encoded (`severity%3Dwarning`), so decode it before
        # matching; comparing the raw URL would silently never match.
        if "/alerting.kubesphere.io/v2beta1/" in url:
            requests.append(urllib.parse.unquote(url))

    ui.page.on("request", lambda request: remember(request.url))
    _pick_option(ui.page, "cluster-alerting-messages:filter:state", "待触发")
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    ui.page.wait_for_timeout(2_000)
    assert any("state=pending" in url for url in requests), "筛选没有走到服务端"
    pending_rows = _row_count(ui.page)
    assert pending_rows <= unfiltered, (pending_rows, unfiltered)

    # ---- severity stacks on top ----
    requests.clear()
    _pick_option(ui.page, "cluster-alerting-messages:filter:severity", "警告")
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    ui.page.wait_for_timeout(2_000)
    stacked = [url for url in requests if "severity=warning" in url]
    assert stacked, "级别筛选没有走到服务端"
    assert any("state=pending" in url for url in stacked), "级别筛选丢掉了状态条件"

    # ---- back to all states ----
    _pick_option(ui.page, "cluster-alerting-messages:filter:state", "全部状态")
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    ui.page.wait_for_timeout(2_000)
    screenshot(ui.page, "cluster-alerting-filters")
