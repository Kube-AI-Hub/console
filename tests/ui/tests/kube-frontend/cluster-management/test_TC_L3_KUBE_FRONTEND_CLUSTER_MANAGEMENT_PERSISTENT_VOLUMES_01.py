from __future__ import annotations

import pytest
from playwright.sync_api import expect

from helpers.reads import ReadError

pytestmark = pytest.mark.ui

PVS = "/api/v1/persistentvolumes"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_PERSISTENT_VOLUMES_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01 持久卷：七列与绑定声明。"""

    ui = cluster_management_page
    assert ui.api is not None

    # PERFORMANCE: ~24s here (the kapis proxy needs 63s for the same list).
    status, body = ui.api.request("GET", PVS, timeout=180)
    if status in (401, 403):
        pytest.skip(f"当前账号无权读取持久卷（HTTP {status}）")
    if status != 200:
        raise ReadError(f"持久卷读取失败：HTTP {status} — {repr(body)[:300]}")
    volumes = body.get("items") or []
    if not volumes:
        pytest.skip("集群没有持久卷，无法核对列表")

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/persistentvolumes")
    surface = ui.page.locator('[data-ai-id="persistentvolumes:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=180_000)

    headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
    assert headers == ["名称", "状态", "容量", "访问模式", "绑定声明", "回收策略", "创建时间"], headers
    # The full header row also carries the selection and row-action columns (empty labels).
    # Locate the claim cell by its header position instead of a magic index.
    all_headers = [text.strip() for text in surface.locator("thead th").all_inner_texts()]
    claim_index = all_headers.index("绑定声明")

    rows = surface.locator("[data-ai-row]")
    expect(rows).to_have_count(len(volumes), timeout=30_000)

    # A bound volume names its claim as namespace/name; a volume without a claim shows
    # "-". The two are different answers and must not collapse into one.
    bound = {v["metadata"]["name"]: (v.get("spec") or {}).get("claimRef") for v in volumes}
    checked = 0
    for name, claim_ref in list(bound.items())[:40]:
        row = surface.locator(f'[data-ai-row="{name}"]')
        if row.count() == 0:
            continue
        cells = [cell.strip() for cell in row.locator("td").all_inner_texts()]
        claim_cell = cells[claim_index]
        if claim_ref:
            assert "/" in claim_cell, (name, claim_cell)
            assert claim_cell == f"{claim_ref.get('namespace')}/{claim_ref.get('name')}", (name, claim_cell)
        else:
            assert claim_cell == "-", (name, claim_cell)
        checked += 1
    assert checked > 0, "no volume row could be compared"

    screenshot(ui.page, "cluster-persistent-volumes")
