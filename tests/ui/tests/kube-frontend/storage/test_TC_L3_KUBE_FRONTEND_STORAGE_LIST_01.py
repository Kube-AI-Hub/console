from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_STORAGE_LIST_01(kube_storage_page, screenshot):
    """TC-L3-KUBE-FRONTEND-STORAGE-LIST-01 存储卷列表：五列与可点击名称。"""

    ui = kube_storage_page
    name = ui.unique("list")
    try:
        ui.create_pvc(name)
        ui.open("persistentvolumeclaims")
        assert ui.state("persistentvolumeclaims") == "ready", ui.state("persistentvolumeclaims")

        headers = ui.headers("persistentvolumeclaims")
        # The five columns the criterion names, in order, with 持久卷 where the old console puts it
        # (after the access modes). The list also carries 挂载状态, which does not change the set.
        assert headers[:5] == ["名称", "状态", "容量", "访问模式", "持久卷"], headers
        assert "创建时间" in headers and "挂载状态" in headers, headers

        ui.ensure_row("persistentvolumeclaims", name)
        link = ui.name_link("persistentvolumeclaims", name)
        expect(link).to_be_visible()
        assert link.get_attribute("href").endswith(f"/persistentvolumeclaims/{name}")

        row = ui.row_text("persistentvolumeclaims", name)
        # The capacity and access mode come from the object, so they hold whether
        # the claim is still Pending or has already been bound by a provisioner.
        assert "1Gi" in row, row
        assert "RWO" in row, row

        # The name is not decoration: clicking it is how the detail is reached.
        ui.click_name("persistentvolumeclaims", name)
        ui.page.wait_for_url(f"**/persistentvolumeclaims/{name}")
        expect(ui.detail_surface("persistentvolumeclaims")).to_be_visible()
        ui.wait_ready(ui.detail_surface("persistentvolumeclaims"))
        screenshot(ui.page, "list")
    finally:
        ui.delete_pvc(name)
