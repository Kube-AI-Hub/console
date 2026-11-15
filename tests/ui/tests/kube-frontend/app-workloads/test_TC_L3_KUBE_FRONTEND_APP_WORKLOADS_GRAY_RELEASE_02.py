from __future__ import annotations

import time
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from pages.canary_page import CanaryPage, strategy_manifest

pytestmark = pytest.mark.ui


def _items(api, path: str) -> list[dict]:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), (status, body)
    return body.get("items") or []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02 创建向导：初始流量、三种类型的 manifest、确认后写入、finally 清理。"""

    ui = app_workloads_page
    assert ui.api is not None
    canary = CanaryPage(ui.page, ui.base, namespace=ui.namespace, api=ui.api)
    api = ui.api

    deployments = _items(api, canary.deployments_path())
    if not deployments:
        pytest.skip("default 项目没有 Deployment，无法验证创建向导")
    deployment = deployments[0]
    workload_name = deployment["metadata"]["name"]
    selector = ((deployment.get("spec") or {}).get("selector") or {}).get("matchLabels") or {}
    target = selector.get("app") or workload_name

    before = len(canary.list_strategies())
    suffix = uuid4().hex[:6]
    names = {
        "Canary": f"tc-e2e-gray-create-{suffix}-canary",
        "Bluegreen": f"tc-e2e-gray-create-{suffix}-bg",
        "Mirror": f"tc-e2e-gray-create-{suffix}-mirror",
    }
    posts: list[str] = []
    ui.page.on(
        "request",
        lambda request: posts.append(request.url) if request.method == "POST" and "strategies" in request.url else None,
    )

    try:
        canary.open_list()
        expect(canary.surface).to_be_visible(timeout=30_000)
        canary.wait_ready()
        expect(canary.create_button).to_be_enabled(timeout=20_000)

        # ---- Canary with 25% initial traffic: the gate, then the write ----
        canary.open_create()
        expect(canary.create_workload.locator("option")).to_have_count(len(deployments), timeout=20_000)
        canary.create_workload.select_option(workload_name)
        canary.fill_create(names["Canary"], type_="Canary", traffic="25")
        canary.create_next.click()
        expect(canary.create_confirm).to_be_visible(timeout=20_000)
        assert canary.get_strategy(names["Canary"]) is None, "点下一步就创建了对象，确认步骤形同虚设"
        time.sleep(0.6)
        assert posts == [], f"确认前发出了写请求: {posts}"

        canary.create_confirm.click()
        assert canary.wait_strategy(names["Canary"], present=True) is not None, "确认后回读不到 Strategy"
        item = canary.get_strategy(names["Canary"])
        assert item is not None
        spec = item.get("spec") or {}
        assert spec.get("type") == "Canary", spec
        assert ((spec.get("selector") or {}).get("matchLabels") or {}).get("app") == target, spec
        assert (((spec.get("template") or {}).get("spec") or {}).get("hosts") or [None])[0] == target, spec
        assert canary.route_weights(names["Canary"]) == [75, 25], canary.route_weights(names["Canary"])
        assert canary.governor_of(names["Canary"]) == "", canary.governor_of(names["Canary"])

        # ---- Bluegreen: 100/0 and the principal governs ----
        canary.open_create()
        canary.create_workload.select_option(workload_name)
        canary.fill_create(names["Bluegreen"], type_="Bluegreen")
        canary.create_next.click()
        expect(canary.create_confirm).to_be_visible(timeout=20_000)
        canary.create_confirm.click()
        assert canary.wait_strategy(names["Bluegreen"], present=True) is not None
        assert canary.route_weights(names["Bluegreen"]) == [100, 0], canary.route_weights(names["Bluegreen"])
        assert canary.governor_of(names["Bluegreen"]) == "v1", canary.governor_of(names["Bluegreen"])

        # ---- Mirror: principal keeps traffic, the canary is a mirror destination ----
        canary.open_create()
        canary.create_workload.select_option(workload_name)
        canary.fill_create(names["Mirror"], type_="Mirror")
        canary.create_next.click()
        expect(canary.create_confirm).to_be_visible(timeout=20_000)
        canary.create_confirm.click()
        assert canary.wait_strategy(names["Mirror"], present=True) is not None
        mirror_item = canary.get_strategy(names["Mirror"]) or {}
        rules = (((mirror_item.get("spec") or {}).get("template") or {}).get("spec") or {}).get("http") or []
        assert rules and (rules[0].get("mirror") or {}).get("subset") == "v2", rules
        assert canary.route_weights(names["Mirror"]) == [100], canary.route_weights(names["Mirror"])

        expect(canary.created_notice).to_be_visible(timeout=20_000)
        for created in names.values():
            expect(canary.row(created)).to_be_visible(timeout=20_000)
        screenshot(ui.page, "gray-release-create")
    finally:
        canary.cleanup(*names.values())
        after = len(canary.list_strategies())
        assert after == before, f"strategies 计数未回到创建前: {before} -> {after}"
