from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

NAMESPACES = "/kapis/resources.kubesphere.io/v1alpha3/namespaces"
QUOTAS = "/api/v1/namespaces/default/resourcequotas"
LIMITRANGES = "/api/v1/namespaces/default/limitranges"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_OVERVIEW_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01 项目概览。"""

    ui = project_settings_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{QUOTAS}")
    hard_keys: list[str] = []
    if status == 200 and isinstance(body, dict):
        items = body.get("items") or []
        if items:
            hard_keys = list(((items[0].get("spec") or {}).get("hard") or {}).keys())

    status, body = ui.api.request("GET", f"{LIMITRANGES}")
    limitrange_items = (body.get("items") or []) if status == 200 and isinstance(body, dict) else []

    ui.page.goto(
        f"{ui.base_url}/kube-frontend/public/clusters/{ui.cluster}/projects/default/overview"
    )
    surface = ui.page.locator('[data-ai-id="project-overview:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    basic = ui.page.locator('[data-ai-id="project-overview:basic"]').inner_text()
    assert "default" in basic, basic[:200]

    quota = ui.page.locator('[data-ai-id="project-overview:quota"]')
    expect(quota).to_be_visible(timeout=20_000)
    rows = ui.page.locator('[data-ai-id="project-overview:quota-list"] [data-ai-row]')
    if hard_keys:
        expect(rows).to_have_count(len(hard_keys), timeout=20_000)
    else:
        expect(quota).to_contain_text("没有设置资源配额", timeout=20_000)

    limits = ui.page.locator('[data-ai-id="project-overview:limitranges"]')
    if limitrange_items:
        expect(limits.locator("[data-ai-row]")).to_have_count(len(limitrange_items), timeout=20_000)
    else:
        expect(limits).to_contain_text("没有限额范围", timeout=20_000)

    links = ui.page.locator('[data-ai-id="project-overview:links"] a')
    hrefs = [links.nth(index).get_attribute("href") for index in range(links.count())]
    assert len(hrefs) >= 5, hrefs
    for expected in ("/projects/default/pods", "/projects/default/deployments", "/projects/default/configmaps"):
        assert any(href and expected in href for href in hrefs), f"缺少快捷入口 {expected}: {hrefs}"

    screenshot(ui.page, "project-overview")
