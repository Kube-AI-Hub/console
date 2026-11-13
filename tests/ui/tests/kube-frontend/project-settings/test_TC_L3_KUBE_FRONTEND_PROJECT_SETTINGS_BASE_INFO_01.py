from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_BASE_INFO_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01 项目基本信息：属性与配额空态。"""

    ui = project_settings_page
    assert ui.api is not None

    status, ns = ui.api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/namespaces/spaces")
    if status != 200:
        pytest.skip("spaces 项目不存在，无法核对基本信息")
    workspace = ((ns.get("metadata") or {}).get("labels") or {}).get("kubesphere.io/workspace", "")

    status, quotas = ui.api.request("GET", "/api/v1/namespaces/spaces/resourcequotas?limit=-1")
    has_quota = status == 200 and isinstance(quotas, dict) and bool(quotas.get("items"))

    ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/host/projects/spaces/baseinfo")
    surface = ui.page.locator('[data-ai-id="project-info:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    labels = [t.strip() for t in surface.locator("dt").all_inner_texts()]
    assert labels == ["名称", "别名", "企业空间", "描述", "创建者", "创建时间"], labels

    # The workspace must come from `kubesphere.io/workspace`; the namespace also
    # carries `kubesphere.io/namespace`, and reading that would show the project name.
    assert ui.page.locator('[data-ai-id="project-info:name"]').inner_text().strip() == "spaces"
    surface_text = surface.inner_text()
    if workspace:
        assert workspace in surface_text, (workspace, surface_text[:120])

    quota_block = ui.page.locator('[data-ai-id="project-info:quota"]')
    expect(quota_block).to_be_visible()
    if has_quota:
        assert quota_block.locator("thead th").count() == 3
    else:
        expect(ui.page.locator('[data-ai-id="project-info:quota-empty"]')).to_be_visible()
        assert "没有设置资源配额" in quota_block.inner_text()
    screenshot(ui.page, "project-base-info")
