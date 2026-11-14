from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

JUICEFS = "juicefs.kubesphere.io/v1alpha1"


def _volumes_path(cluster: str) -> str:
    """The volumes read, with the member-cluster segment where it belongs."""
    if cluster and cluster != "host":
        return "/kapis/clusters/" + cluster + "/" + JUICEFS + "/volumes"
    return "/kapis/" + JUICEFS + "/volumes"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_JUICEFS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01 JuiceFS 共享存储三页签。"""

    ui = cluster_management_page
    assert ui.api is not None, "api client required"

    status, body = ui.api.request("GET", _volumes_path(ui.cluster), timeout=60)
    if status != 200 or not isinstance(body, dict):
        pytest.skip("JuiceFS 卷接口不可用")
    volumes = body.get("items") or []

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/juicefs-storage")
    surface = ui.page.locator('[data-ai-id="cluster-juicefs:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    # Every tab is reachable whether or not the cluster has volumes.
    for tab in ("volumes", "usage", "performance"):
        expect(ui.page.locator(f'[data-ai-id="cluster-juicefs:tab:{tab}"]')).to_be_visible()

    # ---- 卷 ----
    volumes_panel = ui.page.locator('[data-ai-id="cluster-juicefs:volumes"]')
    expect(volumes_panel).to_be_visible()
    if volumes:
        assert surface.get_attribute("data-ai-state") == "ready"
        headers = [header.strip() for header in volumes_panel.locator("thead th").all_inner_texts() if header.strip()]
        for expected in ("名称", "状态", "容量", "已用", "挂载点数", "创建时间"):
            assert expected in headers, headers
        rows = volumes_panel.locator("tbody tr[data-ai-row]")
        expect(rows).to_have_count(len(volumes), timeout=30_000)
        handles = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
        assert set(handles) == {str(item.get("name")) for item in volumes}, handles
    else:
        assert surface.get_attribute("data-ai-state") == "empty"
        assert "暂无共享卷" in volumes_panel.inner_text()
    screenshot(ui.page, "juicefs-volumes")

    # ---- 用量 ----
    ui.page.locator('[data-ai-id="cluster-juicefs:tab:usage"]').click()
    usage = ui.page.locator('[data-ai-id="cluster-juicefs:usage"]')
    expect(usage).to_be_visible(timeout=30_000)
    if volumes:
        usage_text = usage.inner_text()
        for expected in ("卷数量", "总容量", "已用容量", "最高使用率", "各卷用量"):
            assert expected in usage_text, usage_text[:300]
        for item in volumes:
            expect(usage.locator(f'[data-ai-id="cluster-juicefs:usage:{item["name"]}"]')).to_be_visible()
    screenshot(ui.page, "juicefs-usage")

    # ---- 性能 ----
    ui.page.locator('[data-ai-id="cluster-juicefs:tab:performance"]').click()
    performance = ui.page.locator('[data-ai-id="cluster-juicefs:performance"]')
    expect(performance).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    if surface.get_attribute("data-ai-state") == "ready":
        headers = [header.strip() for header in performance.locator("thead th").all_inner_texts() if header.strip()]
        for expected in ("指标", "最新", "平均", "最大", "趋势"):
            assert expected in headers, headers
        assert performance.locator("[data-ai-id^='cluster-juicefs:metric:']").count() > 0
    else:
        # No metrics on this cluster (or none in the window): the tab must say so
        # rather than render an empty table.
        text = performance.inner_text()
        assert "暂无性能数据" in text or "未开启 JuiceFS 指标" in text, text[:300]
    screenshot(ui.page, "juicefs-performance")

    # Switching back leaves the volume list in place.
    ui.page.locator('[data-ai-id="cluster-juicefs:tab:volumes"]').click()
    expect(ui.page.locator('[data-ai-id="cluster-juicefs:volumes"]')).to_be_visible()

    sidebar = ui.page.locator("aside").first.inner_text()
    assert "JuiceFS" in sidebar, sidebar[:300]
