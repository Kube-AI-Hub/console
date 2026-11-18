from __future__ import annotations

import re
import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

RATIO = re.compile(r"^(\d+)\s*/\s*(\d+)$")
PERCENT = re.compile(r"^(\d+(?:\.\d+)?)%$")

SERVICE_NAMESPACES = (
    "kubesphere-system",
    "kube-system",
    "istio-system",
    "kubesphere-monitoring-system",
    "kubesphere-logging-system",
    "kubesphere-devops-system",
)
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
    lowered = raw.lower()
    if lowered == "cpu":
        return "CPU"
    if lowered == "huawei":
        return "ascend"
    known = {
        "cpu", "nvidia", "cambricon", "ascend", "hygon", "metax",
        "enflame", "kunlunxin", "iluvatar", "alibaba", "mthreads",
    }
    return lowered if lowered in known else raw


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_MONITOR_08(cluster_monitor_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-MONITOR-08 集群监控：集群状态分区（节点在线 / XPU 厂商 / 组件状态）。"""

    ui = cluster_monitor_page
    assert ui.api is not None

    # ---- the same reads the overview makes, so the numbers can be cross-checked ----
    health_status, health = ui.component_health()
    assert health_status == 200, f"componenthealth -> {health_status}: {str(health)[:200]}"
    node_status = health.get("nodeStatus") or {}
    healthy, total = int(node_status.get("healthyNodes") or 0), int(node_status.get("totalNodes") or 0)
    assert total > 0, "host 应有节点；totalNodes=0 的空态由 MONITOR-09 覆盖"

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

    # ---- the band exists on the overview tab and sits before the usage section ----
    section = ui.status_section
    expect(section).to_be_visible(timeout=30_000)
    for block in ("node-online", "vendor", "components"):
        expect(ui.status_card(block)).to_be_visible(timeout=30_000)
    usage_box = ui.overview_usage().bounding_box()
    section_box = section.bounding_box()
    assert section_box and usage_box
    assert section_box["y"] < usage_box["y"], "「集群状态」分区必须在资源用量之前"

    # ---- node ring: healthy/total + share ----
    expect(ui.status_node_ratio_locator()).to_be_visible(timeout=30_000)
    ratio = RATIO.match(ui.status_node_ratio())
    assert ratio, f"节点在线应为 healthy/total 形如 1/1: {ui.status_node_ratio()!r}"
    assert (int(ratio.group(1)), int(ratio.group(2))) == (healthy, total), (
        f"页面 {ui.status_node_ratio()} vs 接口 {healthy}/{total}"
    )
    percent = PERCENT.match(ui.status_node_percent())
    assert percent, f"在线比例应为百分比: {ui.status_node_percent()!r}"
    assert abs(float(percent.group(1)) - healthy / total * 100) <= 1.0, percent.group(0)
    href = ui.status_node_link().get_attribute("href") or ""
    assert href.endswith(f"/clusters/{ui.cluster}/nodes"), href

    # ---- vendor composition: one row per vendor, count and share from nodes/stats ----
    expect(ui.status_vendor_list()).to_be_visible(timeout=30_000)
    row_ids = ui.status_vendor_ids()
    assert sorted(row_ids) == sorted(vendors), f"厂商行 {row_ids} vs 接口 {sorted(vendors)}"
    for vendor, count in vendors.items():
        expect(ui.status_vendor_row(vendor)).to_be_visible()
        assert ui.status_vendor_count(vendor) == str(count), (
            f"{vendor} 数量 {ui.status_vendor_count(vendor)!r} vs 接口 {count}"
        )
        share = PERCENT.match(ui.status_vendor_percent(vendor))
        assert share, f"{vendor} 占比不是百分比: {ui.status_vendor_percent(vendor)!r}"
        expected = count / vendor_total * 100
        assert abs(float(share.group(1)) - expected) <= 0.2, (
            f"{vendor} 占比 {share.group(1)}% vs 接口 {expected:.1f}%"
        )
    if vendors.get("cambricon") == vendor_total:
        assert ui.status_vendor_percent("cambricon") == "100%", ui.status_vendor_percent("cambricon")

    # ---- service components: six tiles, each the namespace aggregate of backends ----
    assert ui.status_service_ids() == list(SERVICE_NAMESPACES), ui.status_service_ids()
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
            assert "未安装" in row_text, row_text
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
        assert f"{expected_healthy}/{expected_total}" in row_text, row_text

    # ---- core components: etcd probe, controller-manager and scheduler by label ----
    assert ui.status_core_ids() == ["etcd", "controller-manager", "scheduler"], ui.status_core_ids()
    etcd_text = ui.status_core_row("etcd").inner_text()
    if etcd_status == 200:
        assert "已接入监控" in etcd_text, etcd_text
    elif etcd_status == 404:
        assert "未接入监控" in etcd_text, etcd_text
    for component, label_value in CORE_LABELS.items():
        rows = [item for item in kubesphere_status if (item.get("label") or {}).get("component") == label_value]
        if not rows:
            expected_state = "not-reported"
        elif any(int(item.get("healthyBackends") or 0) > 0 for item in rows):
            expected_state = "healthy"
        else:
            expected_state = "unhealthy"
        assert ui.status_core_status(component) == expected_state, (
            f"{component} 状态 {ui.status_core_status(component)!r} vs 接口 {expected_state}"
        )

    # ---- layout: three blocks on one row, equal gaps; section title at section level ----
    boxes = {block: ui.status_card(block).bounding_box() for block in ("node-online", "vendor", "components")}
    assert all(boxes.values()), boxes
    tops = [box["y"] for box in boxes.values() if box]
    assert max(tops) - min(tops) <= 2, f"宽屏三块 top 未对齐: {tops}"
    heights = [box["height"] for box in boxes.values() if box]
    assert max(heights) - min(heights) <= 2, f"三块高度不一致: {heights}"

    def font_size(locator) -> str:
        return locator.evaluate("element => getComputedStyle(element).fontSize")

    section_title = section.locator(":scope > h2").first
    usage_title = ui.tabpanel("overview").locator("h2").nth(1)
    assert font_size(section_title) == font_size(usage_title), (
        f"分区标题 {font_size(section_title)} vs 资源用量标题 {font_size(usage_title)}"
    )
    screenshot(ui.page, "cluster-monitor-status-host")

    # ---- AC-10: the auto-refresh switch drives the status band's three reads ----
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

    try:
        auto_refresh = ui.page.locator('[data-ai-id="cluster-monitor:auto-refresh"]')
        expect(auto_refresh).to_have_attribute("aria-pressed", "false")
        auto_refresh.click()
        expect(auto_refresh).to_have_attribute("aria-pressed", "true")
        deadline = time.time() + 15
        while time.time() < deadline and not all(status_requests.values()):
            ui.page.wait_for_timeout(250)
        missing = [key for key, hits in status_requests.items() if not hits]
        assert not missing, f"自动刷新开启后 15s 内这些状态查询没有重取: {missing}"
        assert ui.page.locator('[data-ai-id="cluster-monitor:status:node-online:loading"]').count() == 0, (
            "自动刷新重取时不应把已有内容换成骨架"
        )

        auto_refresh.click()
        expect(auto_refresh).to_have_attribute("aria-pressed", "false")
        ui.page.wait_for_timeout(2000)
        settled = {key: len(hits) for key, hits in status_requests.items()}
        ui.page.wait_for_timeout(8000)
        for key in status_requests:
            assert len(status_requests[key]) == settled[key], (
                f"关闭自动刷新后 {key} 仍在请求: {settled[key]} -> {len(status_requests[key])}"
            )
    finally:
        for pattern in status_patterns:
            ui.page.unroute(pattern)

    # ---- narrow: the three blocks stack and the page does not scroll sideways ----
    ui.page.set_viewport_size({"width": 900, "height": 1200})
    ui.page.wait_for_timeout(800)
    stacked = {block: ui.status_card(block).bounding_box() for block in ("node-online", "vendor", "components")}
    assert all(stacked.values()), stacked
    assert stacked["node-online"]["y"] < stacked["vendor"]["y"] < stacked["components"]["y"], stacked
    overflow = ui.page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 1, f"900 宽下出现横向溢出 {overflow}px"
    screenshot(ui.page, "cluster-monitor-status-narrow-900")
