from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_MEMBERS_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01 项目成员：列表四列与角色注解一致。"""

    ui = project_settings_page
    # `default` usually has no members; `spaces` has one. Confirm before asserting, so
    # the case skips instead of failing for missing data.
    members = ui.list_members("spaces")
    if not members:
        pytest.skip("spaces 项目没有成员，无法核对成员列")

    ui.open("members", "spaces")
    ui.wait_ready("members")

    headers = ui.headers("members")
    required = ["名称", "状态", "角色", "最近登录"]
    positions = [headers.index(label) for label in required if label in headers]
    assert len(positions) == len(required), f"missing columns: {set(required) - set(headers)}"
    assert positions == sorted(positions), f"columns out of order: {headers}"

    first = members[0]
    name = first["metadata"]["name"]
    expected_role = (first["metadata"].get("annotations") or {}).get("iam.kubesphere.io/role", "")

    row = ui.surface("members").locator(f'[data-ai-row="{name}"]')
    expect(row).to_be_visible()
    text = row.inner_text()
    assert expected_role in text, (expected_role, text)
    assert "活跃" in text or "已停用" in text, text
    screenshot(ui.page, "project-settings-members")
