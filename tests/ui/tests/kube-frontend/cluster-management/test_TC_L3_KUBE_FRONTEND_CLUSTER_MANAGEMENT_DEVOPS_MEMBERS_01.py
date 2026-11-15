from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

TEST_USER = "ui-test"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_MEMBERS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_MEMBERS-01 成员列表、邀请、改角色与移除。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)
    container = devops.pick_container()
    if container is None:
        pytest.skip("集群没有命名空间可用的 DevOps 工程：成员页签需要真实工程")
    project, _namespace = container

    def row():
        return ui.page.locator(f'[data-ai-id="devops-detail:members-table"] tbody tr[data-ai-row="{TEST_USER}"]')

    try:
        # Only the dedicated test account is touched; a leftover binding is cleaned first.
        if devops.member_role(project, TEST_USER) is not None:
            devops.remove_member_quiet(project, TEST_USER)

        devops.open_project(project)
        devops.open_tab("members")
        devops.expect_exactly_one_state("members")
        table = devops.surface("devops-detail:members-table")
        if table.count() > 0:
            headers = [title.strip() for title in table.locator("thead th").all_inner_texts()]
            assert headers == ["用户名", "角色", "状态", "最近登录", "更多操作"], headers

        # ---- invite dialog: username required, role options are the preset roles only ----
        devops.click("devops-detail:members-invite")
        devops.expect_dialog()
        devops.click("devops:member-invite-submit")
        expect(devops.dialog()).to_contain_text("请输入用户名。")

        devops.click("devops:member-invite-role")
        options = ui.page.get_by_role("option")
        expect(options.first).to_be_visible(timeout=20_000)
        labels = {options.nth(index).inner_text().strip() for index in range(options.count())}
        assert labels == {"viewer", "operator", "admin"}, labels
        ui.page.keyboard.press("Escape")
        devops.select("devops:member-invite-role", "viewer")

        devops.fill("devops:member-invite-username", TEST_USER)
        devops.click("devops:member-invite-submit")
        devops.expect_dialog_closed()
        expect(row()).to_be_visible(timeout=60_000)
        cells = [cell.strip() for cell in row().locator("td").all_inner_texts()]
        assert cells[0] == TEST_USER
        assert cells[1] == "viewer"
        assert devops.member_role(project, TEST_USER) == "viewer"

        # ---- change the role ----
        devops.click(f"devops-detail:member-role:{TEST_USER}")
        devops.expect_dialog()
        devops.select("devops:member-role-select", "operator")
        devops.click("devops:member-role-submit")
        devops.expect_dialog_closed()
        expect(row()).to_contain_text("operator", timeout=60_000)
        assert devops.member_role(project, TEST_USER) == "operator"

        # ---- remove the member: typed-name confirmation ----
        devops.delete_via_dialog(f"devops-detail:member-remove:{TEST_USER}", "devops-detail", TEST_USER)
        expect(row()).to_have_count(0, timeout=60_000)
        assert devops.member_role(project, TEST_USER) is None
        expect(devops.surface("devops-detail:members-empty")).to_be_visible(timeout=60_000)

        screenshot(ui.page, "devops-members")
    finally:
        devops.remove_member_quiet(project, TEST_USER)
