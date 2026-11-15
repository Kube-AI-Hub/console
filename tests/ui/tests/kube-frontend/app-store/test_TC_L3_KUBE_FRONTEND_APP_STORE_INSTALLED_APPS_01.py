from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "system-workspace"
AGGREGATE = f"/kapis/openpitrix.io/v1/workspaces/{WS}/applications"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_INSTALLED_APPS_01(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-01 已安装应用：列表行数、页内搜索与无分页器。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{AGGREGATE}?limit=-1")
    assert status == 200, f"GET {AGGREGATE} -> {status}: {str(body)[:300]}"
    items = (body or {}).get("items") or []

    origin = ui.base_url.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/apps/instances")
    surface = ui.page.locator('[data-ai-id="installed-apps:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    state = surface.get_attribute("data-ai-state")
    rows = surface.locator("tbody tr[data-ai-row]")
    if items:
        assert state == "ready", f"expected ready, got {state}"
        headers = [value.strip() for value in surface.locator("thead th:visible").all_inner_texts() if value.strip()]
        for expected_header in ("名称", "状态", "应用", "版本", "项目", "创建时间"):
            assert expected_header in headers, headers
        expect(rows).to_have_count(len(items), timeout=30_000)

        # 页内搜索：输入首行的 release 名后只保留匹配行。
        first = (items[0].get("cluster") or {}).get("name") or ""
        assert first, items[0]
        ui.page.locator('[data-ai-id="installed-apps:search"]').fill(first)
        expect(rows).to_have_count(1, timeout=30_000)
        ui.page.locator('[data-ai-id="installed-apps:search"]').fill("")
        expect(rows).to_have_count(len(items), timeout=30_000)
    else:
        assert state == "empty", f"expected empty, got {state}"
        assert "还没有已安装的应用" in surface.inner_text()

    # 数据源能力如实标注，且不画服务端分页器。
    note = ui.page.locator('[data-ai-id="installed-apps:source-note"]')
    expect(note).to_be_visible()
    assert "没有服务端分页与搜索" in note.inner_text()
    assert surface.locator("nav[aria-label]").count() == 0 or "下一页" not in surface.inner_text()
    screenshot(ui.page, "installed-apps-list")
