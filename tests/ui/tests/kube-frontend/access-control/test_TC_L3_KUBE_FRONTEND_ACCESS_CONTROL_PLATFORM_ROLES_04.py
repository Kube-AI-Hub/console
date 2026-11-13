from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

ROLES = "/kapis/iam.kubesphere.io/v1alpha2/clusterroles"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_PLATFORM_ROLES_04(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-04 平台角色详情：授权规则。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{ROLES}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取平台角色列表")
    items = body.get("items") or []
    if not items:
        pytest.skip("平台没有平台角色")

    # Prefer a non-template role: those carry the real rules an operator judges.
    target = next((item for item in items if not item["metadata"]["name"].startswith("role-template-")), items[0])
    name = target["metadata"]["name"]
    status, role = ui.api.request("GET", f"{ROLES}/{name}")
    if status != 200 or not isinstance(role, dict):
        pytest.skip("无法读取角色对象")
    rules = role.get("rules") or []

    ui.page.goto(f"{ui.base_url}/kube-frontend/access/clusterroles")
    surface = ui.page.locator('[data-ai-id="clusterroles:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    ui.page.locator('[data-ai-id="clusterroles:search"]').fill(name)
    ui.page.wait_for_timeout(2_000)
    row = surface.locator(f'[data-ai-row="{name}"]')
    expect(row).to_be_visible(timeout=20_000)
    link = row.locator("a").first
    expect(link).to_have_attribute("href", f"/kube-frontend/access/clusterroles/{name}")
    link.click()

    detail = ui.page.locator('[data-ai-id="clusterrole-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    assert f"/access/clusterroles/{name}" in ui.page.url, ui.page.url

    basic = ui.page.locator('[data-ai-id="clusterrole-detail:basic"]').inner_text()
    assert name in basic, basic[:200]
    # The count is the claim; the table is the evidence.
    assert str(len(rules)) in basic, f"规则数应为 {len(rules)}: {basic[:200]}"

    table_rows = ui.page.locator('[data-ai-id="clusterrole-detail:rule-table"] [data-ai-row]')
    if rules:
        expect(table_rows).to_have_count(len(rules), timeout=20_000)
    else:
        assert table_rows.count() == 0
        expect(ui.page.locator('[data-ai-id="clusterrole-detail:rules"]')).to_contain_text("没有规则", timeout=20_000)

    screenshot(ui.page, "platform-role-detail")
