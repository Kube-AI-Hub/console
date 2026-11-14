from __future__ import annotations

import time
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

STRATEGIES = "/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/default/strategies"
DEPLOYMENTS = "/apis/apps/v1/namespaces/default/deployments"


def _strategy(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{STRATEGIES}/{name}")
    return body if status == 200 and isinstance(body, dict) else None


def _wait(api, name: str, present: bool, timeout: float = 60) -> dict | None:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = _strategy(api, name)
        if (last is not None) == present:
            return last
        time.sleep(1)
    return last


def _items(api, path: str) -> list[dict]:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status} {body}"
    return body.get("items") or []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_GRAY_RELEASE_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02 灰度发布：最小创建向导、确认后写入、列表可见、finally 清理。"""

    ui = app_workloads_page
    assert ui.api is not None
    api = ui.api

    deployments = _items(api, DEPLOYMENTS)
    if not deployments:
        pytest.skip("default 项目没有 Deployment，无法验证创建向导")
    deployment = deployments[0]
    workload_name = deployment["metadata"]["name"]
    selector = ((deployment.get("spec") or {}).get("selector") or {}).get("matchLabels") or {}
    target = selector.get("app") or workload_name

    before = _items(api, STRATEGIES)
    name = f"tc-e2e-gray-create-{uuid4().hex[:6]}"
    posts: list[str] = []
    ui.page.on(
        "request",
        lambda request: posts.append(request.url)
        if request.method == "POST" and "strategies" in request.url
        else None,
    )

    try:
        ui.open("grayrelease")
        surface = ui.surface("grayrelease")
        expect(surface).to_be_visible(timeout=30_000)
        ui.wait_ready(surface)

        # ---- open the wizard ----
        create = ui.page.locator('[data-ai-id="grayrelease:create"]')
        expect(create).to_be_visible(timeout=20_000)
        create.click()
        dialog = ui.page.locator('[data-ai-id="grayrelease:create-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)

        ui.page.locator('[data-ai-id="grayrelease:create-name"]').fill(name)
        # The workload picker lists the project's Deployments; the first one is used.
        workload = ui.page.locator('[data-ai-id="grayrelease:create-workload"]')
        expect(workload.locator("option")).to_have_count(len(deployments), timeout=20_000)
        workload.select_option(workload_name)
        type_select = ui.page.locator('[data-ai-id="grayrelease:create-type"]')
        expect(type_select.locator("option")).to_have_count(3)
        type_select.select_option("Canary")

        # ---- next: confirmation gate, nothing written yet ----
        ui.page.locator('[data-ai-id="grayrelease:create-next"]').click()
        expect(ui.page.locator('[data-ai-id="grayrelease:create-confirm"]')).to_be_visible(timeout=20_000)
        assert name in dialog.inner_text(), dialog.inner_text()[:300]
        assert _strategy(api, name) is None, "点下一步就创建了对象，确认步骤形同虚设"
        time.sleep(0.8)
        assert posts == [], f"确认前发出了写请求: {posts}"

        # ---- confirm: object appears with the selected workload/type ----
        ui.page.locator('[data-ai-id="grayrelease:create-confirm"]').click()
        created = _wait(api, name, present=True)
        assert created is not None, "确认后回读不到 Strategy"
        spec = created.get("spec") or {}
        assert spec.get("type") == "Canary", spec
        assert ((spec.get("selector") or {}).get("matchLabels") or {}).get("app") == target, spec
        template_spec = ((spec.get("template") or {}).get("spec") or {})
        assert (template_spec.get("hosts") or [None])[0] == target, template_spec
        assert (template_spec.get("http") or [])[0].get("route"), template_spec

        expect(dialog).to_be_hidden(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="grayrelease:created"]')).to_be_visible(timeout=20_000)
        row = ui.row("grayrelease", name)
        expect(row).to_be_visible(timeout=30_000)
        assert "金丝雀发布" in row.inner_text(), row.inner_text()
        screenshot(ui.page, "gray-release-create")
    finally:
        status, _ = api.request("DELETE", f"{STRATEGIES}/{name}")
        assert status in (200, 404), f"清理 Strategy 失败: {status}"
        assert _wait(api, name, present=False) is None, "finally 未删除 Strategy"
        after = _items(api, STRATEGIES)
        assert len(after) == len(before), f"strategies 计数未回到创建前: {len(before)} -> {len(after)}"
        assert not any(item.get("metadata", {}).get("name", "").startswith("tc-e2e-gray-create-") for item in after), after
