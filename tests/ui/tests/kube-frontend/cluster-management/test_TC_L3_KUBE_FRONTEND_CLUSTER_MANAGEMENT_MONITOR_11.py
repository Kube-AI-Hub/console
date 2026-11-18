from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: The cluster range endpoint, the component endpoints and the node-ranking read:
#: counting them is the only way to prove an unmounted tab issues nothing.
CLUSTER_RANGE = "**/monitoring.kubesphere.io/v1alpha3/cluster**"
COMPONENTS = "**/monitoring.kubesphere.io/v1alpha3/components/**"
NODE_RANK = "**/monitoring.kubesphere.io/v1alpha3/nodes**"

#: Metrics that only the physical-resource tab asks for. Overview has its own
#: cluster range query (usage + RDMA summary), so the assertion cannot be
#: "no cluster request" — it must be "not this tab's request".
RESOURCE_ONLY = ("cluster_disk_read_iops", "cluster_net_bytes_received")


def _wait_until(predicate, timeout: float = 30.0, interval: float = 0.25) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_11(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-11 集群监控：页签 IA 与深链（默认概览、?tab=、单一页头控件）。"""

    ui = cluster_monitor_page

    ui.open()
    ui.wait_ready()

    # ---- five tabs, in the contract's order, overview selected by default ----
    assert ui.tab_ids() == list(ui.TABS), f"页签集合/顺序: {ui.tab_ids()}"
    assert ui.active_tab() == "overview", f"默认页签应为 overview: {ui.active_tab()}"
    expect(ui.tabpanel("overview")).to_be_visible(timeout=30_000)
    for key in ui.TABS[1:]:
        # Radix keeps the inactive panels in the DOM but hidden; what must not exist is
        # their content (and therefore their queries). The request accounting below
        # proves that part; here we assert the visible surface is the overview only.
        expect(ui.tabpanel(key)).to_be_hidden()

    # ---- every tab is clickable and writes ?tab= into the URL ----
    for key in ("resource", "apiserver", "scheduler", "ranking"):
        ui.select_tab(key)
        assert ui.active_tab() == key, f"点 {key} 后选中了 {ui.active_tab()}"
        assert f"tab={key}" in ui.page.url, f"地址栏没有同步 tab={key}: {ui.page.url}"
        expect(ui.tabpanel(key)).to_be_visible()
        visible = [other for other in ui.TABS if ui.tabpanel(other).is_visible()]
        assert visible == [key], f"只应显示当前页签，实际 {visible}"

    # ---- deep link: a URL alone lands on the named tab ----
    ui.open("scheduler")
    ui.wait_ready()
    assert ui.active_tab() == "scheduler", ui.active_tab()
    assert "tab=scheduler" in ui.page.url, ui.page.url
    expect(ui.tabpanel("scheduler")).to_be_visible()
    screenshot(ui.page, "cluster-monitor-tab-scheduler-deeplink")

    # A refresh keeps the tab, because the URL is the state (replace, not memory).
    ui.page.reload()
    ui.wait_ready()
    assert ui.active_tab() == "scheduler", f"刷新后应仍在 scheduler: {ui.active_tab()}"
    expect(ui.tabpanel("scheduler")).to_be_visible()

    # A copied URL opens on the same tab in a fresh page.
    second = ui.page.context.new_page()
    try:
        second.goto(ui.page.url)
        second.wait_for_selector('[data-ai-id="cluster-monitor:tabpanel:scheduler"]', timeout=30_000)
        assert second.locator('[data-ai-id="cluster-monitor:tab:scheduler"]').get_attribute("data-state") == "active"
    finally:
        second.close()

    # ---- an unknown tab is ignored, not an error page ----
    ui.page.goto(f"{ui.url}?tab=bogus")
    ui.wait_ready()
    assert ui.active_tab() == "overview", f"非法 tab 应回退 overview: {ui.active_tab()}"
    expect(ui.tabpanel("overview")).to_be_visible()

    # ---- the conditional etcd tab is hidden when the ServiceMonitor is 404 ----
    # This deployment has no etcd ServiceMonitor, so the 6th tab must not exist and a
    # deep link to it must fall back to the overview rather than paint a blank panel.
    assert ui.page.locator('[data-ai-id="cluster-monitor:tab:etcd"]').count() == 0, "未接入 etcd 监控时不应有 etcd 页签"
    ui.page.goto(f"{ui.url}?tab=etcd")
    ui.wait_ready()
    assert ui.active_tab() == "overview", f"?tab=etcd 在页签隐藏时应回退 overview: {ui.active_tab()}"
    expect(ui.tabpanel("overview")).to_be_visible()

    # ---- exactly one window control and one auto-refresh for the whole page ----
    assert ui.page.locator('[data-ai-id^="cluster-monitor:range:"]').count() == 4, (
        f"页头时间窗按钮应为 4 个: {ui.page.locator('[data-ai-id^=\"cluster-monitor:range:\"]').count()}"
    )
    assert ui.page.locator('[data-ai-id="cluster-monitor:auto-refresh"]').count() == 1
    for key in ui.TABS:
        panel = ui.tabpanel(key)
        if panel.count() == 0:
            continue
        assert panel.locator('[data-ai-id^="cluster-monitor:range:"]').count() == 0, f"{key} 页签内不应有第二套时间窗"
        assert panel.locator('[data-ai-id="cluster-monitor:auto-refresh"]').count() == 0, f"{key} 页签内不应有第二个刷新开关"

    # ---- only the mounted tab queries: unmounted tabs must stay silent ----
    hits: dict[str, list[str]] = {"cluster": [], "components": [], "rank": []}

    def recorder(kind: str):
        def handler(route):
            hits[kind].append(route.request.url)
            route.continue_()
        return handler

    for pattern, kind in ((CLUSTER_RANGE, "cluster"), (COMPONENTS, "components"), (NODE_RANK, "rank")):
        ui.page.route(pattern, recorder(kind))

    try:
        ui.open()
        ui.wait_ready()
        time.sleep(1.0)
        # The overview carries a 服务组件监控 preview (APIServer + Scheduler), so those two
        # reads are expected here; etcd is not — it belongs to the conditional tab, and a
        # request for it would mean the tab's content mounted while the tab is not shown.
        overview_components = " ".join(hits["components"])
        assert "/components/apiserver" in overview_components, (
            f"overview 应请求 apiserver 组件指标（服务组件监控块）: {hits['components'][:2]}"
        )
        assert "/components/scheduler" in overview_components, (
            f"overview 应请求 scheduler 组件指标（服务组件监控块）: {hits['components'][:2]}"
        )
        assert "/components/etcd" not in overview_components, (
            f"overview 不应请求 etcd 组件指标（属条件页签）: {hits['components'][:2]}"
        )
        assert hits["rank"] == [], f"overview 不应请求节点排行: {hits['rank'][:2]}"
        assert not any(
            metric in url for url in hits["cluster"] for metric in RESOURCE_ONLY
        ), f"overview 不应请求物理资源专用指标: {[url for url in hits['cluster'] if any(m in url for m in RESOURCE_ONLY)][:2]}"

        ui.select_tab("resource")
        assert _wait_until(lambda: any("cluster_disk_read_iops" in url for url in hits["cluster"])), (
            "打开 resource 页签后应请求物理资源指标"
        )

        ui.select_tab("apiserver")
        assert _wait_until(lambda: any("/components/apiserver" in url for url in hits["components"])), (
            "打开 apiserver 页签后应请求组件指标"
        )

        ui.select_tab("scheduler")
        assert _wait_until(lambda: any("/components/scheduler" in url for url in hits["components"])), (
            "打开 scheduler 页签后应请求调度器组件指标"
        )

        ui.select_tab("ranking")
        assert _wait_until(lambda: any("type=rank" in url for url in hits["rank"])), (
            "打开 ranking 页签后应请求节点排行"
        )
    finally:
        for pattern in (CLUSTER_RANGE, COMPONENTS, NODE_RANK):
            ui.page.unroute(pattern)

    # ---- surface state follows the current tab's main query ----
    ui.select_tab("overview")
    ui.wait_ready()
    state = ui.state()
    assert state in ("ready", "empty", "error"), f"surface state 不应停留在 loading: {state}"

    # ---- the tab strip reads as one control: aligned tops, no sideways overflow ----
    boxes = [ui.tab(key).bounding_box() for key in ui.TABS]
    assert all(boxes), boxes
    tops = [box["y"] for box in boxes if box]
    assert max(tops) - min(tops) <= 2, f"页签 top 未对齐: {tops}"
    overflow = ui.page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"1600 宽下出现横向溢出 {overflow}px"
    screenshot(ui.page, "cluster-monitor-tabs-overview")