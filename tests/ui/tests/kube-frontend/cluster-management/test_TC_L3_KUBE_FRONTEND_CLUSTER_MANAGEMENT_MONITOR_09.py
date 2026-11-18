from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

from pages.cluster_monitor import ClusterMonitorPage

pytestmark = pytest.mark.ui

#: The member cluster that is expected to be joined-but-not-ready. Its whole
#: /kapis/clusters/test/* surface answers 500 "cluster test is not ready".
NOT_READY_CLUSTER = "test"

#: Glob (not a compiled regex) so page.unroute can remove the same pattern again.
COMPONENTHEALTH = "**/componenthealth*"
NODES_STATS = "**/nodes/stats*"


def _cluster_ready(record: dict) -> bool:
    conditions = (record.get("status") or {}).get("conditions") or []
    return any(
        condition.get("type") == "Ready" and str(condition.get("status")).lower() == "true"
        for condition in conditions
    )


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_09(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-09 集群监控：未就绪整页接管与状态分区加载/空/未上报/无权限/失败分支。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    # ---- AC-09: a not-ready member cluster never mounts the monitor page ----
    status, clusters = ui.api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/clusters")
    assert status == 200, f"clusters -> {status}: {str(clusters)[:200]}"
    items = clusters.get("items") or []
    record = next(
        (item for item in items if (item.get("metadata") or {}).get("name") == NOT_READY_CLUSTER),
        None,
    )
    if record is None:
        pytest.skip(f"本部署没有成员集群 {NOT_READY_CLUSTER}，未就绪分支无法真实复现")
    if _cluster_ready(record):
        pytest.skip(f"成员集群 {NOT_READY_CLUSTER} 已就绪，未就绪分支无法真实复现")

    not_ready_page = ClusterMonitorPage(ui.page, ui.base_url, NOT_READY_CLUSTER, ui.api)
    not_ready_page.page.goto(not_ready_page.url)
    not_ready = ui.page.locator('[data-ai-id="cluster:not-ready"]')
    expect(not_ready).to_be_visible(timeout=60_000)

    overview_link = ui.page.locator('[data-ai-id="cluster:not-ready-overview"]')
    expect(overview_link).to_be_visible(timeout=30_000)
    href = overview_link.get_attribute("href") or ""
    assert href.endswith(f"/clusters/{NOT_READY_CLUSTER}/overview"), href

    # The whole page is the waiting panel: no monitor surface, no trends, no status band,
    # and above all no retry button (retrying a cluster that has not joined cannot help).
    assert ui.page.locator('[data-ai-id="cluster-monitor:surface"]').count() == 0, "未就绪时不应挂载监控页"
    assert ui.page.locator('[data-ai-id="cluster-monitor:status"]').count() == 0, "未就绪时不应显示状态分区"
    assert ui.page.locator('[data-ai-id="cluster-monitor:chart"]').count() == 0, "未就绪时不应画趋势"
    assert ui.page.locator('[data-ai-id$=":retry"]').count() == 0, "未就绪时不应提供重试"
    body = not_ready.inner_text()
    assert "等待" in body or "未就绪" in body or "not ready" in body.lower(), body[:200]
    screenshot(ui.page, "cluster-monitor-not-ready-test")

    # ---- status-band branches on the ready host cluster ----
    def open_host() -> None:
        ui.open()
        # Trends are independent of the status band, but "still loading" is not a
        # useful state to assert against: wait for the page to reach ready first.
        ui.wait_ready()
        expect(ui.status_section).to_be_visible(timeout=30_000)

    open_host()
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    baseline_ratio = ui.status_node_ratio()
    baseline_vendors = ui.status_vendor_ids()
    assert baseline_vendors, "host 的厂商分布不应为空"
    assert baseline_ratio.startswith("1/") or re.match(r"^\d+/\d+$", baseline_ratio), baseline_ratio

    # 403 on componenthealth: permission on the node and component blocks, no retry.
    ui.page.route(COMPONENTHEALTH, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    open_host()
    expect(ui.status_block_permission("node-online")).to_be_visible(timeout=30_000)
    expect(ui.status_permission()).to_be_visible(timeout=30_000)
    assert ui.status_block_retry("node-online").count() == 0, "无权限时节点块不应提供重试"
    assert ui.status_retry().count() == 0, "无权限时组件块不应提供重试"
    # The vendor block reads nodes/stats and must stay on real data.
    assert ui.status_vendor_ids() == baseline_vendors, "componenthealth 无权限不应影响厂商块"
    ui.page.unroute(COMPONENTHEALTH)

    # nodes/stats 403: only the vendor block is permission; node and component blocks stay real.
    ui.page.route(NODES_STATS, lambda route: route.fulfill(status=403, json={"message": "forbidden"}))
    open_host()
    expect(ui.status_block_permission("vendor")).to_be_visible(timeout=30_000)
    assert ui.status_block_retry("vendor").count() == 0, "无权限时厂商块不应提供重试"
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    expect(ui.status_service_row("kube-system")).to_be_visible(timeout=30_000)
    ui.page.unroute(NODES_STATS)
    screenshot(ui.page, "cluster-monitor-status-permission")

    # 5xx on componenthealth: error + retry on both blocks; the trend section is untouched.
    requests: list[str] = []

    def unavailable(route):
        requests.append(route.request.url)
        route.fulfill(status=500, json={"message": "component health unavailable"})

    ui.page.route(COMPONENTHEALTH, unavailable)
    open_host()
    expect(ui.status_block_error("node-online")).to_be_visible(timeout=30_000)
    expect(ui.status_error()).to_be_visible(timeout=30_000)
    expect(ui.status_block_retry("node-online")).to_be_visible(timeout=30_000)
    expect(ui.status_retry()).to_be_visible(timeout=30_000)
    assert ui.charts() + ui.empty_cards() == 29, "组件状态失败不应清空趋势分区"

    before = len(requests)
    ui.status_retry().click()
    deadline = time.time() + 30
    while len(requests) <= before and time.time() < deadline:
        ui.page.wait_for_timeout(200)
    assert len(requests) > before, "点重试后没有重新请求 componenthealth"

    # Remove the failure and retry: the block recovers instead of staying red.
    ui.page.unroute(COMPONENTHEALTH)
    ui.status_retry().click()
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    assert ui.status_node_ratio() == baseline_ratio, ui.status_node_ratio()
    screenshot(ui.page, "cluster-monitor-status-error")

    # 5xx on nodes/stats: only the vendor block fails; node and component blocks stay real.
    ui.page.route(NODES_STATS, unavailable)
    open_host()
    expect(ui.status_vendor_branch("error")).to_be_visible(timeout=30_000)
    expect(ui.status_block_retry("vendor")).to_be_visible(timeout=30_000)
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    assert ui.status_node_ratio() == baseline_ratio, ui.status_node_ratio()
    expect(ui.status_service_row("kube-system")).to_be_visible(timeout=30_000)
    ui.page.unroute(NODES_STATS)

    # componenthealth 200 but no nodeStatus: 未上报, not 0/0.
    ui.page.route(COMPONENTHEALTH, lambda route: route.fulfill(status=200, json={"kubesphereStatus": []}))
    open_host()
    expect(ui.status_node_unreported()).to_be_visible(timeout=30_000)
    assert "未上报" in ui.status_node_unreported().inner_text()
    assert ui.status_node_ratio_locator().count() == 0, "未上报时不应渲染 0/0"
    ui.page.unroute(COMPONENTHEALTH)

    # totalNodes=0: an empty state, not a normal 0/0.
    ui.page.route(
        COMPONENTHEALTH,
        lambda route: route.fulfill(
            status=200,
            json={"nodeStatus": {"totalNodes": 0, "healthyNodes": 0}, "kubesphereStatus": []},
        ),
    )
    open_host()
    expect(ui.status_node_empty()).to_be_visible(timeout=30_000)
    assert "暂无" in ui.status_node_empty().inner_text()
    assert ui.status_node_ratio_locator().count() == 0, "totalNodes=0 时不应把 0/0 当正常态"
    ui.page.unroute(COMPONENTHEALTH)

    # nodes/stats 200 with an empty object: an explicit empty state, not an empty bar.
    ui.page.route(NODES_STATS, lambda route: route.fulfill(status=200, json={}))
    open_host()
    expect(ui.status_vendor_empty()).to_be_visible(timeout=30_000)
    assert "暂无" in ui.status_vendor_empty().inner_text()
    assert ui.status_vendor_ids() == [], "空数据时不应渲染厂商行"
    ui.page.unroute(NODES_STATS)

    # Trends failing must not blank the status band: the two reads are independent.
    ui.page.route(
        "**/monitoring.kubesphere.io/v1alpha3/cluster*",
        lambda route: route.fulfill(status=500, json={"message": "monitoring unavailable"}),
    )
    open_host()
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    assert ui.status_node_ratio() == baseline_ratio, ui.status_node_ratio()
    assert ui.status_vendor_ids() == baseline_vendors, ui.status_vendor_ids()
    expect(ui.status_service_row("kube-system")).to_be_visible(timeout=30_000)
    ui.page.unroute("**/monitoring.kubesphere.io/v1alpha3/cluster*")

    # Remove every interception: the band is real again.
    open_host()
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    assert ui.status_node_ratio() == baseline_ratio, ui.status_node_ratio()
    assert ui.status_vendor_ids() == baseline_vendors, ui.status_vendor_ids()
    screenshot(ui.page, "cluster-monitor-status-restored")
