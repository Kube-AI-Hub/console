from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

POLICIES = "/apis/networking.k8s.io/v1/namespaces/spaces/networkpolicies"
NS_READ = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/spaces"
NS_PATCH = "/api/v1/namespaces/spaces"


def _isolation(ui) -> str | None:
    _, body = ui.api.request("GET", NS_READ)
    return ((body.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/network-isolate")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_NETWORK_ISOLATION_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01 网络隔离：策略列表与隔离开关。"""

    ui = project_settings_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{POLICIES}?limit=-1")
    if status != 200:
        pytest.skip("无法读取网络策略，无法核对列表")
    policies = body.get("items") or []
    if not policies:
        pytest.skip("spaces 项目没有网络策略，无法核对列表")

    original = _isolation(ui)
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/spaces/networkpolicies")
        surface = ui.page.locator('[data-ai-id="networkpolicies:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        headers = [t.strip() for t in surface.locator("thead th:visible").all_inner_texts() if t.strip()]
        required = ["名称", "策略类型", "规则数", "创建时间"]
        positions = [headers.index(label) for label in required if label in headers]
        assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
        assert positions == sorted(positions), f"columns out of order: {headers}"

        # The list is paged at 10, so the visible rows are the first page of the API set.
        visible = surface.locator("[data-ai-row]").count()
        assert visible == min(len(policies), 10), (visible, len(policies))

        # The switch reflects, and then writes, the annotation KubeSphere stores intent in.
        expect(surface.locator('[data-ai-id="networkpolicies:isolate-toggle"]')).to_be_visible()
        before = "true" if original == "true" else "false"
        surface.locator('[data-ai-id="networkpolicies:isolate-toggle"] button').click()
        ui.page.wait_for_timeout(2500)
        after = _isolation(ui)
        assert str(after).lower() == ("false" if before == "true" else "true"), (before, after)
        screenshot(ui.page, "network-isolation")
    finally:
        # Leave the project exactly as it was found.
        ui.api.request("PATCH", NS_PATCH, {"metadata": {"annotations": {"kubesphere.io/network-isolate": original}}})
