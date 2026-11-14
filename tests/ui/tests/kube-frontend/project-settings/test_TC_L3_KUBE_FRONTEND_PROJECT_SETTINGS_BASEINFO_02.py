from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

IAM = "/kapis/iam.kubesphere.io/v1alpha2"
RESOURCES = "/kapis/resources.kubesphere.io/v1alpha3"


def _total(ui, path: str) -> int:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    assert isinstance(body, dict) and "totalItems" in body, body
    return int(body["totalItems"])


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_BASEINFO_02(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02 项目基本信息 · 成员/角色/服务账号统计。"""

    ui = project_settings_page
    assert ui.api is not None

    members = _total(ui, f"{IAM}/namespaces/default/members?limit=1")
    roles = _total(ui, f"{IAM}/namespaces/default/roles?limit=1")
    service_accounts = _total(ui, f"{RESOURCES}/namespaces/default/serviceaccounts?limit=1")

    ui.page.goto(f"{ui.base_url}/kube-frontend/public/clusters/{ui.cluster}/projects/default/baseinfo")
    surface = ui.page.locator('[data-ai-id="project-info:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    expect(ui.page.locator('[data-ai-id="settings-baseinfo:stats"]')).to_be_visible(timeout=30_000)
    expect(ui.page.locator('[data-ai-id="settings-baseinfo:stat:members"]')).to_have_text(str(members), timeout=60_000)
    expect(ui.page.locator('[data-ai-id="settings-baseinfo:stat:roles"]')).to_have_text(str(roles), timeout=60_000)
    expect(ui.page.locator('[data-ai-id="settings-baseinfo:stat:serviceaccounts"]')).to_have_text(
        str(service_accounts), timeout=60_000
    )

    # The attribute list above is a <dl>; the stats must not have changed its labels.
    labels = [text.strip() for text in surface.locator("dt").all_inner_texts()]
    assert labels == ["名称", "别名", "企业空间", "描述", "创建者", "创建时间"], labels

    screenshot(ui.page, "project-baseinfo-stats")
