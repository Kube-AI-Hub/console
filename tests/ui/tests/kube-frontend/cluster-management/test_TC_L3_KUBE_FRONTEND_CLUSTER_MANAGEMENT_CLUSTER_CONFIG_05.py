from __future__ import annotations

import time
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SA = "/api/v1/namespaces/default/serviceaccounts"
KAPIS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/serviceaccounts"


def _create(ui, name: str) -> None:
    body = {
        "apiVersion": "v1",
        "kind": "ServiceAccount",
        "metadata": {"name": name, "namespace": "default", "annotations": {"kubesphere.io/description": "e2e 初始描述"}},
    }
    status, response = ui.api.request("POST", SA, body)
    assert status in (200, 201), f"创建服务账号 {name} 失败：{status} {repr(response)[:200]}"


def _delete(ui, name: str) -> None:
    ui.api.request("DELETE", f"{SA}/{quote(name)}")


def _description(ui, name: str) -> str:
    status, body = ui.api.request("GET", f"{KAPIS}/{quote(name)}")
    if status != 200 or not isinstance(body, dict):
        return ""
    return str((body.get("metadata") or {}).get("annotations", {}).get("kubesphere.io/description", ""))


def _open_row_menu(ui, row) -> None:
    """Open a row's menu and wait until its items are actually rendered.

    The click can land on a row that the search's refetch replaces a moment later: the
    menu opens and closes with it, so "click succeeded" is not "menu is open".
    """
    for attempt in range(3):
        try:
            row.get_by_role("button", name="更多操作").click(timeout=10_000)
        except Exception:
            if attempt == 2:
                raise
            ui.page.wait_for_timeout(1_000)
            continue
        if ui.page.get_by_role("menuitem").count() > 0:
            return
        ui.page.wait_for_timeout(800)
    raise AssertionError("更多操作菜单没有打开")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_CONFIG_05(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-05 集群级服务账号：行操作。"""

    ui = cluster_management_page
    assert ui.api is not None

    name = f"tc-e2e-sa-{int(time.time()) % 100000}"
    _create(ui, name)
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/serviceaccounts")
        surface = ui.page.locator('[data-ai-id="cluster-serviceaccounts:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        ui.page.locator('[data-ai-id="cluster-serviceaccounts:search"]').fill(name)
        row = ui.page.locator(f'[data-ai-row="default/{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        expect(surface.locator("[data-ai-row]")).to_have_count(1, timeout=30_000)
        ui.page.wait_for_timeout(500)

        _open_row_menu(ui, row)
        for label in ("编辑", "编辑 YAML", "修改角色", "删除"):
            expect(ui.page.get_by_role("menuitem", name=label, exact=True)).to_be_visible(timeout=10_000)

        ui.page.get_by_role("menuitem", name="编辑", exact=True).click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        dialog.locator("textarea").first.fill("e2e 集群页已更新")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        deadline = time.time() + 30
        seen = ""
        while time.time() < deadline:
            seen = _description(ui, name)
            if seen == "e2e 集群页已更新":
                break
            time.sleep(1)
        assert seen == "e2e 集群页已更新", f"描述注解没有被更新：{seen!r}"

        _open_row_menu(ui, row)
        ui.page.get_by_role("menuitem", name="删除").click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        confirm.locator("input").first.fill(name)
        confirm.get_by_role("button", name="删除").click()
        expect(confirm).to_have_count(0, timeout=30_000)

        deadline = time.time() + 30
        remaining = ["still-there"]
        while time.time() < deadline:
            status, body = ui.api.request("GET", f"{KAPIS}?name={quote(name)}")
            items = (body.get("items") if isinstance(body, dict) else None) or []
            remaining = [str((item.get("metadata") or {}).get("name")) for item in items]
            if status == 200 and not remaining:
                break
            time.sleep(1)
        assert not remaining, f"删除后对象仍然存在：{remaining}"
        screenshot(ui.page, "cluster-serviceaccounts-writes")
    finally:
        _delete(ui, name)