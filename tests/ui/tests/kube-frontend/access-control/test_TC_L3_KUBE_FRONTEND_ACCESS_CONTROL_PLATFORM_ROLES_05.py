from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

BINDINGS = "/apis/rbac.authorization.k8s.io/v1/clusterrolebindings"
ROLE = "cluster-admin"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_PLATFORM_ROLES_05(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-05 平台角色详情：已授权用户。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{BINDINGS}?limit=500")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取 clusterrolebindings")
    subjects = []
    for item in body.get("items") or []:
        if ((item.get("roleRef") or {}).get("name")) != ROLE:
            continue
        subjects.extend(item.get("subjects") or [])
    if not subjects:
        pytest.skip(f"{ROLE} 没有授权对象，无法核对")

    ui.page.goto(f"{ui.base_url}/kube-frontend/access/clusterroles/{ROLE}")
    surface = ui.page.locator('[data-ai-id="clusterrole-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    block = ui.page.locator('[data-ai-id="clusterrole-detail:subjects"]')
    expect(block).to_contain_text(f"({len(subjects)})", timeout=30_000)
    rows = ui.page.locator('[data-ai-id="clusterrole-detail:subject-list"] [data-ai-row]')
    expect(rows).to_have_count(len(subjects), timeout=20_000)

    first = subjects[0]
    name = str(first.get("name") or "")
    kind = str(first.get("kind") or "")
    row_text = rows.first.inner_text()
    assert name in row_text, row_text
    assert kind in row_text, row_text

    screenshot(ui.page, "platform-role-subjects")
