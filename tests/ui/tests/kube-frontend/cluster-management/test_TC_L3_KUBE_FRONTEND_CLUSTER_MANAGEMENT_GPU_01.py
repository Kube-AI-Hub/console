from __future__ import annotations

import re
from urllib.parse import quote

import pytest
from playwright.sync_api import Locator, expect

pytestmark = pytest.mark.ui

GPU_API = "/kapis/gpu.kubesphere.io/v1alpha1/gpus"

#: The status cell renders one of these, depending on the console language. The
#: assertion is locale-tolerant because the environment can run either dictionary.
HEALTHY_LABELS = {"健康", "Healthy"}
UNHEALTHY_LABELS = {"亚健康", "Degraded"}


def _devices(api) -> list[dict] | None:
    """Every physical card, the way the page reads them (limit=-1 is the whole set)."""
    status, body = api.request("GET", f"{GPU_API}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        return None
    items = body.get("items")
    return items if isinstance(items, list) else None


def _row_health(row: Locator) -> bool | None:
    """Read one row's verdict from its status cell.

    The status is the only cell whose whole text is one of the health labels; matching
    the row's text would be wrong because 亚健康 contains 健康.
    """
    for text in row.locator("td").all_inner_texts():
        value = text.strip()
        if value in HEALTHY_LABELS:
            return True
        if value in UNHEALTHY_LABELS:
            return False
    return None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GPU_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01 集群显卡：行数/健康比例/单卡详情。"""

    ui = cluster_management_page
    assert ui.api is not None

    devices = _devices(ui.api)
    if not devices:
        pytest.skip("集群没有 GPU 设备（或 gpu.kubesphere.io 接口不可用）")

    by_uuid = {str(item.get("uuid")): item for item in devices if item.get("uuid")}

    status, stats = ui.api.request("GET", f"{GPU_API}/stats")
    if status != 200 or not isinstance(stats, dict):
        pytest.skip("GPU stats 接口不可用")
    assert int(stats.get("total", -1)) == len(devices), "stats.total 与列表 items 数不一致（同一个 cache 不应出现）"

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gpus")
    surface = ui.page.locator('[data-ai-id="cluster-gpus:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    rows = surface.locator("[data-ai-row]")
    expected = devices[:20]
    assert rows.count() == len(expected), f"当前页行数 {rows.count()} 与接口分页 items {len(expected)} 不一致"
    shown = [str(value) for value in rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")]
    assert set(shown) == {item["uuid"] for item in expected}, "当前页 UUID 集合与接口不一致"
    healthy_count = sum(1 for uuid in shown if by_uuid[uuid].get("health") is True)

    # Each row's verdict must be the interface's verdict for that UUID, and the number
    # of healthy rows must match the interface's health:true count exactly.
    shown_healthy = 0
    for uuid in shown:
        row = ui.page.locator(f'[data-ai-id="cluster-gpus:row:{uuid}"]').last
        verdict = _row_health(row)
        assert verdict is not None, f"{uuid} 的状态列没有渲染健康/亚健康"
        assert verdict is bool(by_uuid[uuid].get("health")), f"{uuid} 页面状态与接口 health 不一致"
        shown_healthy += 1 if verdict else 0
    assert shown_healthy == healthy_count, f"健康行数 {shown_healthy} 与接口 health:true {healthy_count} 不一致"

    # The overview is the server's aggregate, not a sum of the rows the page happens to
    # show; it must agree with /gpus/stats.
    banner = ui.page.locator('[data-ai-id="cluster-gpus:health"]')
    expect(banner).to_be_visible(timeout=20_000)
    assert int(banner.get_attribute("data-ai-total") or -1) == int(stats["total"]), "比例条的 total 与 stats 不一致"
    assert int(banner.get_attribute("data-ai-healthy") or -1) == int(stats["healthy"]), "比例条的 healthy 与 stats 不一致"

    # ---- US2: one row opens the card whose UUID that row shows ----
    first_uuid = shown[0]
    first = by_uuid[first_uuid]
    ui.page.locator(f'[data-ai-id="cluster-gpus:uuid:{first_uuid}"]').click()
    expect(ui.page).to_have_url(re.compile(rf"/gpus/{re.escape(quote(first_uuid, safe=''))}$"), timeout=30_000)

    detail = ui.page.locator('[data-ai-id="gpu-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    heading = ui.page.locator('[data-ai-id="gpu-detail:uuid"]')
    expect(heading).to_have_text(first_uuid, timeout=20_000)

    basic = ui.page.locator('[data-ai-id="gpu-detail:basic"]').inner_text()
    vendor = {"nvidia": "英伟达", "cambricon": "寒武纪"}.get(first.get("deviceVendor"), first.get("deviceVendor", ""))
    for expected in (str(first.get("nodeName") or ""), str(first.get("type") or ""), str(vendor)):
        if expected:
            assert expected in basic, f"详情基本信息缺少 {expected!r}: {basic[:300]}"
    assert str(first.get("index")) in basic, f"详情缺少序号 {first.get('index')}: {basic[:300]}"

    memory = ui.page.locator('[data-ai-id="gpu-detail:memory"]').inner_text().strip()
    assert "GiB" in memory, f"显存没有换算并标注单位: {memory!r}"
    core = ui.page.locator('[data-ai-id="gpu-detail:core"]').inner_text().strip()
    assert "/" in core, f"核心用量不是 已用/总量 形式: {core!r}"

    # A UUID that is no longer reported is an explicit message, not a blank page.
    missing_uuid = "GPU-tc-e2e-does-not-exist"
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gpus/{quote(missing_uuid, safe='')}")
    expect(ui.page.locator('[data-ai-id="gpu-detail:missing"]')).to_be_visible(timeout=30_000)

    # Back to the list for the screenshot, and wait for it to settle: capturing the
    # loading skeleton would document nothing about the page.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/gpus")
    final_surface = ui.page.locator('[data-ai-id="cluster-gpus:surface"]').last
    expect(final_surface).to_be_visible(timeout=30_000)
    expect(final_surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(ui.page.locator('[data-ai-id="cluster-gpus:health"]')).to_be_visible(timeout=20_000)
    screenshot(ui.page, "cluster-gpus")
