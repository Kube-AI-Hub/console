from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: CRD-backed rule groups: the cluster page lists one scope per tab.
API = "/apis/alerting.kubesphere.io/v2beta1"
#: Aggregated alert messages: two collections, each with `totalItems`.
KAPIS = "/kapis/alerting.kubesphere.io/v2beta1"

#: Page sizes the pages declare; the row count is expected to be capped by them.
MESSAGES_PAGE_SIZE = 20
POLICIES_PAGE_SIZE = 50


def _items(api, path: str) -> list[dict]:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status} {body}"
    return body.get("items") or []


def _total(api, path: str) -> int:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status} {body}"
    return int(body.get("totalItems") or 0)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_ALERTING_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING-01 集群级告警：消息合并与策略两页签。"""

    ui = cluster_management_page
    assert ui.api is not None

    # ---- policies: one tab per collection, counts from the API ----
    custom_count = len(_items(ui.api, f"{API}/clusterrulegroups"))
    builtin_count = len(_items(ui.api, f"{API}/globalrulegroups"))

    ui.page.goto(ui.url("alerting-policies"))
    surface = ui.page.locator('[data-ai-id="cluster-alerting-policies:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    rows = surface.locator("[data-ai-row]")
    expect(rows).to_have_count(min(custom_count, POLICIES_PAGE_SIZE), timeout=30_000)

    ui.page.locator('[data-ai-id="cluster-alerting-policies:tab:builtin"]').click()
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(rows).to_have_count(min(builtin_count, POLICIES_PAGE_SIZE), timeout=60_000)

    # Built-in groups are installer-owned: the row menu must not offer a switch.
    if builtin_count:
        rows.first.locator('button[aria-haspopup="menu"]').click()
        expect(ui.page.get_by_role("menuitem", name="详情", exact=True)).to_be_visible(timeout=20_000)
        assert ui.page.get_by_role("menuitem", name="停用", exact=True).count() == 0
        assert ui.page.get_by_role("menuitem", name="启用", exact=True).count() == 0
        ui.page.keyboard.press("Escape")

    screenshot(ui.page, "cluster-alerting-policies")

    # ---- messages: merged collections, first page = min(20, total) ----
    custom_total = _total(ui.api, f"{KAPIS}/clusteralerts?limit=1")
    builtin_total = _total(ui.api, f"{KAPIS}/globalalerts?limit=1")
    expected = min(MESSAGES_PAGE_SIZE, custom_total + builtin_total)

    ui.page.goto(ui.url("alerting-messages"))
    messages = ui.page.locator('[data-ai-id="cluster-alerting-messages:surface"]').last
    expect(messages).to_be_visible(timeout=30_000)
    expect(messages).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(messages.locator("[data-ai-row]")).to_have_count(expected, timeout=60_000)

    headers = " ".join(
        text.strip() for text in messages.locator("thead th:visible").all_inner_texts() if text.strip()
    )
    assert "来源" in headers, f"消息表缺来源列: {headers}"

    screenshot(ui.page, "cluster-alerting-messages")
