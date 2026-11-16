from __future__ import annotations

import pytest
from playwright.sync_api import expect

from helpers.reads import ReadError, read_list

pytestmark = pytest.mark.ui

CRDS = "/apis/apiextensions.k8s.io/v1/customresourcedefinitions"


def _crd_sample(api, count: int = 20) -> list[dict]:
    """A cheap sample of CRDs, used to pick a target kind and scope."""
    return read_list(api, f"{CRDS}?limit={count}", "CRD 列表", timeout=120, attempts=1)


def _crd_total(api) -> int:
    """How many CRDs exist, read from one small request.

    The page under test asks for `limit=-1`, so its row count must equal this total -- that is the
    assertion's whole point. Fetching the full set here to compare against would cost several
    megabytes and minutes (measured: over 240s through the kapis proxy), which is why the total
    is read from `limit=1` + `metadata.remainingItemCount` instead: same number, ~1.2s.
    """
    status, body = api.request("GET", f"{CRDS}?limit=1", timeout=120, attempts=1)
    if status != 200:
        raise ReadError(f"CRD 列表读取失败：HTTP {status} — {repr(body)[:300]}")
    items = (body or {}).get("items") or []
    remaining = ((body or {}).get("metadata") or {}).get("remainingItemCount")
    # A cluster small enough to answer in one page has no `remainingItemCount`.
    return len(items) if remaining is None else len(items) + int(remaining)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CUSTOM_RESOURCES_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01 自定义资源：列表与作用域一致。"""

    ui = cluster_management_page
    assert ui.api is not None

    crds = _crd_sample(ui.api)
    if not crds:
        pytest.skip("集群没有 CRD，无法核对列表")
    total_crds = _crd_total(ui.api)

    # Pick a target with a kind and a scope, so the assertions below have something
    # concrete to compare against rather than a shape.
    target = next(
        (crd for crd in crds if (crd.get("spec") or {}).get("names", {}).get("kind")),
        None,
    )
    if target is None:
        pytest.skip("CRD 都没有 kind，无法核对")
    kind = target["spec"]["names"]["kind"]
    scope = target["spec"].get("scope", "")
    name = target["metadata"]["name"]

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/custom-resources")
    surface = ui.page.locator('[data-ai-id="custom-resources:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert surface.get_attribute("data-ai-state") == "ready", surface.get_attribute("data-ai-state")

    headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
    required = ["类型", "名称", "作用域", "已提供", "创建时间"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    # Row count against the API: a request without limit=-1 silently returns one page.
    rows = surface.locator("[data-ai-row]")
    assert rows.count() == total_crds, f"行数 {rows.count()} 与接口的 {total_crds} 不一致（是否漏了 limit=-1）"

    # Search by kind — the word someone writes in a manifest — must find it.
    ui.page.locator('[data-ai-id="custom-resources:search"]').last.fill(kind)
    ui.page.wait_for_timeout(900)
    first = rows.first
    assert first.get_attribute("data-ai-row") is not None, "搜索后没有行"
    first_text = first.inner_text()
    assert kind in first_text, f"搜索 {kind} 后首行不是它: {first_text[:80]}"

    # Scope wording has one correct translation per value; anything else means the
    # column is showing the raw API value.
    row_text = surface.locator(f'[data-ai-row="{name}"]').inner_text()
    expected_scope = "命名空间级" if scope == "Namespaced" else "集群级"
    assert expected_scope in row_text, f"作用域应为 {expected_scope}（接口 scope={scope}）: {row_text[:120]}"

    # served is derived from versions[].served; reading it at the CRD level would make
    # every row claim to be served.
    served = any(v.get("served", True) for v in (target["spec"].get("versions") or []) or [{}])
    expected_badge = "已提供" if served else "未提供"
    assert expected_badge in row_text, f"已提供徽标应为 {expected_badge}: {row_text[:120]}"

    screenshot(ui.page, "cluster-custom-resources")
