from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTER_NAV = 'nav[aria-label="主导航"]'


def _not_ready_cluster(ui) -> str | None:
    """The first cluster whose Ready condition is not True, or None when all are ready."""
    status, clusters = ui.api.request("GET", "/kapis/cluster.kubesphere.io/v1alpha1/clusters")
    assert status == 200, status
    for item in clusters.get("items", []):
        ready = next((c for c in item.get("status", {}).get("conditions", []) if c.get("type") == "Ready"), None)
        if ready is None or ready.get("status") != "True":
            return item["metadata"]["name"]
    return None


def _expand_groups(page) -> None:
    """Open every collapsed sidebar group so its leaves are in the DOM."""
    nav = page.locator(CLUSTER_NAV)
    for button in nav.locator("button").all():
        if button.get_attribute("aria-expanded") == "false":
            button.click()


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_12(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-12 未就绪集群的导航与页面守卫。"""
    ui = cluster_overview_page
    target = _not_ready_cluster(ui)
    if target is None:
        pytest.skip("环境里没有未就绪集群，导航禁用与守卫无法验证")

    ui.cluster = target
    ui.open()
    ui.wait_ready()
    _expand_groups(ui.page)

    # ---- 侧栏：概览放行，其余禁用且不给 href ----
    leaves = ui.page.locator(f"{CLUSTER_NAV} a")
    assert leaves.count() >= 2, "侧栏应至少渲染概览与一个分组叶子项"

    overview = ui.page.locator(f'{CLUSTER_NAV} a[href$="/overview"]')
    expect(overview).to_have_count(1)
    assert overview.first.get_attribute("aria-disabled") is None, "概览不应被禁用"

    locked = ui.page.locator(f'{CLUSTER_NAV} a[aria-disabled="true"]')
    assert locked.count() >= 1, "未就绪集群的其它页面应被禁用"
    for index in range(locked.count()):
        item = locked.nth(index)
        assert item.get_attribute("href") is None, "禁用项不应保留 href"
        assert (item.get_attribute("title") or "").strip(), "禁用项应说明原因"

    screenshot(ui.page, f"cluster-nav-locked-{target}")

    # ---- 直接访问被禁页面：给出同语言说明与回概览的入口 ----
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{target}/nodes")
    guard = ui.page.locator('[data-ai-id="cluster:not-ready"]')
    expect(guard).to_be_visible()
    back = ui.page.locator('[data-ai-id="cluster:not-ready-overview"]')
    expect(back).to_have_attribute("href", f"/kube-frontend/clusters/{target}/overview")

    body = ui.page.locator("body").inner_text()
    assert "尚未加入" in body or "not joined" in body, body[:300]
    # 不把 apiserver 的英文原文直接抛给读者
    assert f"cluster {target} is not ready" not in body, "应显示本地化说明，不是 apiserver 原文"

    screenshot(ui.page, f"cluster-guard-{target}")
