from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = "/kapis/tenant.kubesphere.io/v1alpha2/workspaces"
NAMESPACES = "/kapis/resources.kubesphere.io/v1alpha3/namespaces"
PAGE_SIZE = 20


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02 企业空间控制台 · 配额（项目 × 资源）。"""

    ui = access_control_page
    assert ui.api is not None

    workspaces = [
        (item.get("metadata") or {}).get("name")
        for item in (_read(ui, f"{WORKSPACES}?limit=-1").get("items") or [])
    ]
    candidates = [name for name in workspaces if name]
    if not candidates:
        pytest.skip("没有可用的企业空间")
    workspace = candidates[0]

    # Expected rows: every `spec.hard` key of every project's ResourceQuota, the same
    # flattening the page does. Both the projects and the quotas are read through the API
    # so the assertion is about the page, not about a fixture this cluster may not have.
    projects = [
        (item.get("metadata") or {}).get("name")
        for item in (
            _read(ui, f"{NAMESPACES}?labelSelector=kubesphere.io/workspace%3D{workspace}&limit=-1").get("items") or []
        )
    ]
    expected_rows = 0
    for project in [name for name in projects if name]:
        for quota in _read(ui, f"/api/v1/namespaces/{project}/resourcequotas").get("items") or []:
            expected_rows += len(((quota.get("spec") or {}).get("hard") or {}))

    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{workspace}/quota")
    surface = ui.page.locator('[data-ai-id="workspace-quota:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    state = surface.get_attribute("data-ai-state")
    rows = surface.locator("tbody tr[data-ai-row]")
    if expected_rows == 0:
        assert state == "empty", f"expected empty state, got {state}"
        expect(rows).to_have_count(0)
    else:
        assert state == "ready", f"expected ready state, got {state}"
        headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
        for expected_header in ("项目", "资源", "上限", "已使用"):
            assert expected_header in headers, headers
        expect(rows).to_have_count(min(expected_rows, PAGE_SIZE), timeout=30_000)

    sidebar = ui.page.locator("aside").first.inner_text()
    for entry in ("配额", "租户(企业空间)角色", "用户组"):
        assert entry in sidebar, sidebar[:300]

    screenshot(ui.page, "workspace-quota")
