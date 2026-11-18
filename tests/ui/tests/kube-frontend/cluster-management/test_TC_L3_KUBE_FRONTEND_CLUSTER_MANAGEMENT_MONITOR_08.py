from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

RATIO = re.compile(r"^(\d+)\s*/\s*(\d+)$")
PERCENT = re.compile(r"^(\d+(?:\.\d+)?)%$")

#: The six services the section prints, keyed by the namespace componenthealth reports.
SERVICE_NAMESPACES = (
    "kubesphere-system",
    "kube-system",
    "istio-system",
    "kubesphere-monitoring-system",
    "kubesphere-logging-system",
    "kubesphere-devops-system",
)

#: Which configz switch decides whether a service is installed (None: always installed).
SERVICE_MODULES = {
    "kubesphere-system": None,
    "kube-system": "kubernetes",
    "istio-system": "servicemesh",
    "kubesphere-monitoring-system": "monitoring",
    "kubesphere-logging-system": "logging",
    "kubesphere-devops-system": "devops",
}

CORE_LABELS = {
    "controller-manager": "kube-controller-manager",
    "scheduler": "kube-scheduler",
}


def _vendor_key(raw: str) -> str:
    """The normalisation ClusterStatusSection applies before grouping vendor counts."""
    lower = raw.lower()
    if lower == "cpu":
        return "CPU"
    return "ascend" if lower == "huawei" else lower


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_08(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08 集群监控：集群状态分区（节点在线 / XPU 厂商 / 组件状态）。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    # ---- the same reads the section makes, taken once so the numbers can be cross-checked ----
    health_status, health = ui.component_health()
    assert health_status == 200, f"componenthealth -> {health_status}: {str(health)[:200]}"
    node_status = health.get("nodeStatus") or {}
    assert "healthyNodes" in node_status and "totalNodes" in node_status, node_status
    healthy, total = int(node_status["healthyNodes"]), int(node_status["totalNodes"])
    assert total > 0, "host 应该有节点；totalNodes=0 走空态分支，由 MONITOR-09 覆盖"

    stats_status, stats = ui.node_vendor_stats()
    assert stats_status == 200, f"nodes/stats -> {stats_status}: {str(stats)[:200]}"
    vendors: dict[str, int] = {}
    for raw, count in (stats or {}).items():
        if str(raw) in ("healthy", "total"):
            continue
        key = _vendor_key(str(raw))
        vendors[key] = vendors.get(key, 0) + int(count)
    vendors = {vendor: count for vendor, count in vendors.items() if count > 0}
    vendor_total = sum(vendors.values())

    configz_status, configz = ui.configz()
    modules: dict[str, bool] = configz if configz_status == 200 else {}

    etcd_status, _ = ui.etcd_service_monitor()

    ui.open()
    ui.wait_ready()

    # ---- AC-08: the section exists, sits before the trends, and has all three cards ----
    section = ui.status_section
    expect(section).to_be_visible(timeout=30_000)
    for block in ("node-online", "vendor", "components"):
        expect(ui.status_card(block)).to_be_visible(timeout=30_000)

    first_group = ui.page.locator('[data-ai-id^="cluster-monitor:group:"]').first
    expect(first_group).to_be_visible(timeout=30_000)
    section_box = section.bounding_box()
    group_box = first_group.bounding_box()
    assert section_box and group_box
    assert section_box["y"] < group_box["y"], "「集群状态」分区必须在趋势分组之前"

    # ---- node online: healthy/total and the ratio, both computed from the API ----
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    ratio_text = ui.status_node_ratio()
    ratio = RATIO.match(ratio_text)
    assert ratio, f"节点在线应为 healthy/total 形如 1/1: {ratio_text!r}"
    assert (int(ratio.group(1)), int(ratio.group(2))) == (healthy, total), (
        f"页面 {ratio_text} vs 接口 {healthy}/{total}"
    )
    percent_text = ui.status_node_percent()
    percent = PERCENT.match(percent_text)
    assert percent, f"在线比例应为百分比: {percent_text!r}"
    assert abs(float(percent.group(1)) - healthy / total * 100) <= 1.0, percent_text

    link = ui.status_node_link()
    expect(link).to_be_visible()
    href = link.get_attribute("href") or ""
    assert href.endswith(f"/clusters/{ui.cluster}/nodes"), href

    # ---- vendor distribution: one row per vendor, count and share from the API ----
    expect(ui.status_vendor_list()).to_be_visible(timeout=30_000)
    row_ids = ui.status_vendor_ids()
    assert sorted(row_ids) == sorted(vendors), f"厂商行 {row_ids} vs 接口 {sorted(vendors)}"
    for vendor, count in vendors.items():
        row = ui.status_vendor_row(vendor)
        expect(row).to_be_visible()
        assert ui.status_vendor_count(vendor) == str(count), (
            f"{vendor} 数量 {ui.status_vendor_count(vendor)!r} vs 接口 {count}"
        )
        share = PERCENT.match(ui.status_vendor_percent(vendor))
        assert share, f"{vendor} 占比不是百分比: {ui.status_vendor_percent(vendor)!r}"
        expected = count / vendor_total * 100
        assert abs(float(share.group(1)) - expected) <= 0.2, (
            f"{vendor} 占比 {share.group(1)}% vs 接口 {expected:.1f}%"
        )
    # The old console printed the share as 1.00%; 100% is the fixed reading, and it is the
    # one assertion that cannot pass by accident on a single-vendor cluster.
    if vendors.get("cambricon") == vendor_total:
        assert ui.status_vendor_percent("cambricon") == "100%", ui.status_vendor_percent("cambricon")

    # ---- service components: six rows, each the namespace aggregate of backends ----
    service_ids = ui.status_service_ids()
    assert service_ids == list(SERVICE_NAMESPACES), f"服务组件行与顺序: {service_ids}"
    kubesphere_status = health.get("kubesphereStatus") or []
    for namespace in SERVICE_NAMESPACES:
        row = ui.status_service_row(namespace)
        expect(row).to_be_visible()
        state = ui.status_service_status(namespace)
        module = SERVICE_MODULES[namespace]
        enabled = module is None or modules.get(module, True)
        rows = [item for item in kubesphere_status if item.get("namespace") == namespace]
        row_text = row.inner_text()

        if not enabled:
            assert state == "not-installed", f"{namespace} 未启用应为 not-installed: {state}"
            assert "未安装" in row_text, f"{namespace} 未启用应显示未安装: {row_text!r}"
            continue

        if not rows:
            assert state == "not-reported", f"{namespace} 无记录应为 not-reported: {state}"
            continue

        expected_healthy = sum(int(item.get("healthyBackends") or 0) for item in rows)
        expected_total = sum(int(item.get("totalBackends") or 0) for item in rows)
        if expected_total <= 0:
            assert state == "not-reported", f"{namespace} 总后端为 0 应为 not-reported: {state}"
            continue

        expected_state = "healthy" if expected_healthy == expected_total else "unhealthy"
        assert state == expected_state, f"{namespace} 状态 {state!r} vs 接口 {expected_healthy}/{expected_total}"
        assert f"{expected_healthy}/{expected_total}" in row_text, (
            f"{namespace} 文本 {row_text!r} 缺少 {expected_healthy}/{expected_total}"
        )

    # ---- core components: etcd probe, controller-manager and scheduler by label ----
    core_ids = ui.status_core_ids()
    assert core_ids == ["etcd", "controller-manager", "scheduler"], core_ids

    etcd_text = ui.status_core_row("etcd").inner_text()
    if etcd_status == 200:
        assert "已接入监控" in etcd_text, etcd_text
    elif etcd_status == 404:
        assert "未接入监控" in etcd_text, etcd_text
    else:
        assert ui.status_core_status("etcd") in ("permission", "error"), (etcd_status, etcd_text)

    for component, label_value in CORE_LABELS.items():
        rows = [
            item
            for item in kubesphere_status
            if (item.get("label") or {}).get("component") == label_value
        ]
        if not rows:
            expected_state = "not-reported"
        elif any(int(item.get("healthyBackends") or 0) > 0 for item in rows):
            expected_state = "healthy"
        else:
            expected_state = "unhealthy"
        assert ui.status_core_status(component) == expected_state, (
            f"{component} 状态 {ui.status_core_status(component)!r} vs 接口 {expected_state}"
        )
        expected_text = {"healthy": "正常", "unhealthy": "异常", "not-reported": "未上报"}[expected_state]
        assert expected_text in ui.status_core_row(component).inner_text(), (
            f"{component} 应显示 {expected_text}"
        )

    # ---- the rest of the page is still there ----
    assert ui.groups() == ["gpu", "host", "disk", "network", "rdma"], ui.groups()
    total_cards = ui.charts() + ui.empty_cards()
    assert total_cards == 29, f"趋势卡片数应为 29，实际 {total_cards}"
    expect(ui.page.locator('[data-ai-id="cluster-monitor:components"]')).to_be_visible(timeout=30_000)

    # ---- AC-08 layout: three cards on one row, equal gaps, section title at group-title size ----
    boxes = {
        block: ui.status_card(block).bounding_box()
        for block in ("node-online", "vendor", "components")
    }
    assert all(boxes.values()), boxes
    tops = [box["y"] for box in boxes.values()]
    assert max(tops) - min(tops) <= 2, f"宽屏三块卡片 top 未对齐: {tops}"
    node_box, vendor_box, components_box = boxes["node-online"], boxes["vendor"], boxes["components"]
    gap_left = vendor_box["x"] - (node_box["x"] + node_box["width"])
    gap_right = components_box["x"] - (vendor_box["x"] + vendor_box["width"])
    assert gap_left > 0, gap_left
    assert abs(gap_left - gap_right) <= 1, f"两列间距不一致: {gap_left} vs {gap_right}"

    def font_size(locator) -> str:
        return locator.evaluate("element => getComputedStyle(element).fontSize")

    def font_weight(locator) -> str:
        return locator.evaluate("element => getComputedStyle(element).fontWeight")

    section_title = ui.page.locator('[data-ai-id="cluster-monitor:status"] > h2').first
    group_title = first_group.locator(':scope > h2').first
    assert font_size(section_title) == font_size(group_title), (
        f"分区标题 {font_size(section_title)} vs 分组标题 {font_size(group_title)}"
    )
    assert font_weight(section_title) == font_weight(group_title)

    screenshot(ui.page, "cluster-monitor-status-host")

    # ---- AC-10: auto refresh drives the status band's three reads, not only the trends ----
    # One switch for the page: with it on, componenthealth / nodes-stats / etcd servicemonitor
    # are re-read on the same 5-second beat as the trends; with it off, the timers stop.
    # Counting the actual requests (rather than reading request timestamps off the page) is the
    # only assertion that cannot pass on a switch that merely changes its own label.
    status_requests: dict[str, list[float]] = {"componenthealth": [], "nodes/stats": [], "etcd": []}

    def recorder(key: str):
        def handler(route):
            status_requests[key].append(time.time())
            route.continue_()
        return handler

    status_patterns = {
        "**/componenthealth*": "componenthealth",
        "**/nodes/stats*": "nodes/stats",
        "**/servicemonitors/etcd*": "etcd",
    }
    for pattern, key in status_patterns.items():
        ui.page.route(pattern, recorder(key))

    auto_refresh = ui.page.locator('[data-ai-id="cluster-monitor:auto-refresh"]')
    expect(auto_refresh).to_have_attribute("aria-pressed", "false")
    auto_refresh.click()
    expect(auto_refresh).to_have_attribute("aria-pressed", "true")
    # 5s interval plus scheduling slack: poll instead of sleeping a fixed amount, and require
    # each of the three reads to fire again rather than one of them standing in for the rest.
    deadline = time.time() + 15
    while time.time() < deadline and not all(status_requests.values()):
        ui.page.wait_for_timeout(250)
    missing = [key for key, hits in status_requests.items() if not hits]
    assert not missing, f"自动刷新开启后 15s 内这些状态查询没有重取: {missing}"
    # A refetch is not a reload: the reminder must not turn the band into a skeleton wall.
    assert ui.status_node_branch("loading").count() == 0, "自动刷新重取时不应把已有内容换成骨架"

    auto_refresh.click()
    expect(auto_refresh).to_have_attribute("aria-pressed", "false")
    # Let a tick that was already in flight settle, then watch one full interval.
    ui.page.wait_for_timeout(2000)
    settled = {key: len(hits) for key, hits in status_requests.items()}
    ui.page.wait_for_timeout(8000)
    for key in status_requests:
        assert len(status_requests[key]) == settled[key], (
            f"关闭自动刷新后 {key} 仍在请求: {settled[key]} -> {len(status_requests[key])}"
        )
    for pattern in status_patterns:
        ui.page.unroute(pattern)

    # ---- narrow: the same three cards stack, and the page does not scroll sideways ----
    ui.page.set_viewport_size({"width": 900, "height": 1200})
    ui.page.wait_for_timeout(800)
    stacked = {block: ui.status_card(block).bounding_box() for block in ("node-online", "vendor", "components")}
    assert all(stacked.values()), stacked
    assert stacked["node-online"]["y"] < stacked["vendor"]["y"] < stacked["components"]["y"], stacked
    overflow = ui.page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    assert overflow <= 1, f"900 宽下出现横向溢出 {overflow}px"
    screenshot(ui.page, "cluster-monitor-status-narrow-900")
