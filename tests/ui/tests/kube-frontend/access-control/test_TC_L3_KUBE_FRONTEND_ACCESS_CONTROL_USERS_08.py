from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


def _menu_labels(page) -> list[str]:
    return [item.strip() for item in page.get_by_role("menuitem").all_inner_texts()]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_08(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08 用户列表：预置账号与当前用户保护。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-pr-{uuid.uuid4().hex[:6]}"
    created, _ = ui.api.request(
        "POST",
        USERS,
        {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {"name": name},
            "spec": {"email": f"{name}@example.com", "password": "TcE2e@2026", "lang": "zh"},
        },
    )
    assert created in (200, 201), created

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/access/users")
        surface = ui.page.locator('[data-ai-id="users:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="users:search"]').fill(name)
        ui.page.wait_for_timeout(2_500)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=30_000)
        row = surface.locator(f'[data-ai-row="{name}"]')
        expect(row).to_be_visible(timeout=20_000)
        row.locator('button[aria-haspopup="menu"]').click()
        labels = _menu_labels(ui.page)
        for needed in ("重置密码", "停用", "删除", "编辑信息"):
            assert needed in labels, labels
        ui.page.keyboard.press("Escape")

        ui.page.locator('[data-ai-id="users:search"]').fill("admin")
        ui.page.wait_for_timeout(2_500)
        admin = surface.locator('[data-ai-row="admin"]')
        expect(admin).to_be_visible(timeout=20_000)
        expect(admin.locator('input[type="checkbox"]')).to_have_count(0)
        menu = admin.locator('button[aria-haspopup="menu"]')
        if menu.count():
            menu.click()
            admin_labels = _menu_labels(ui.page)
            for banned in ("停用", "删除", "重置密码", "启用", "编辑信息", "修改平台角色"):
                assert banned not in admin_labels, admin_labels
            ui.page.keyboard.press("Escape")
        screenshot(ui.page, "users-preset-protect")
    finally:
        ui.api.request("DELETE", f"{USERS}/{name}")
