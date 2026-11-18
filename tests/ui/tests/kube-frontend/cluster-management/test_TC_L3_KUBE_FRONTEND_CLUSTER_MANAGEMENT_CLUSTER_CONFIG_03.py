from __future__ import annotations

import time
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CONFIGMAPS = "/api/v1/namespaces/default/configmaps"
KAPIS = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/configmaps"


def _create(ui, name: str) -> str:
    body = {
        "apiVersion": "v1",
        "kind": "ConfigMap",
        "metadata": {
            "name": name,
            "namespace": "default",
            "annotations": {"kubesphere.io/description": "e2e 初始描述"},
        },
        "data": {"a.yaml": "x: 1"},
    }
    status, payload = ui.api.request("POST", CONFIGMAPS, body)
    assert status in (200, 201), f"创建配置字典 {name} 失败：{status} {repr(payload)[:200]}"
    return name


def _delete(ui, name: str) -> None:
    ui.api.request("DELETE", f"{CONFIGMAPS}/{quote(name)}")


def _open_row_menu(ui, row) -> None:
    """Click a row's 更多操作, retrying if the row is replaced by a refetch mid-click."""
    for attempt in range(3):
        try:
            row.get_by_role("button", name="更多操作").click(timeout=10_000)
            return
        except Exception:
            if attempt == 2:
                raise
            ui.page.wait_for_timeout(1_000)


def _description(ui, name: str) -> str:
    status, body = ui.api.request("GET", f"{KAPIS}/{quote(name)}")
    if status != 200 or not isinstance(body, dict):
        return ""
    return str((body.get("metadata") or {}).get("annotations", {}).get("kubesphere.io/description", ""))


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_CONFIG_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03 集群级配置字典：行操作。"""

    ui = cluster_management_page
    assert ui.api is not None

    name = f"tc-e2e-cm-{int(time.time()) % 100000}"
    _create(ui, name)
    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/configmaps")
        surface = ui.page.locator('[data-ai-id="cluster-configmaps:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        ui.page.locator('[data-ai-id="cluster-configmaps:search"]').fill(name)
        row = ui.page.locator(f'[data-ai-row="default/{name}"]')
        expect(row).to_be_visible(timeout=30_000)
        # Let the debounced search's refetch finish before clicking: the row element is
        # replaced when the list re-renders, and a click mid-swap detaches it.
        expect(surface.locator("[data-ai-row]")).to_have_count(1, timeout=30_000)
        ui.page.wait_for_timeout(500)

        _open_row_menu(ui, row)
        for label in ("编辑信息", "编辑 YAML", "编辑设置", "删除"):
            expect(ui.page.get_by_role("menuitem", name=label)).to_be_visible(timeout=10_000)

        ui.page.get_by_role("menuitem", name="编辑信息").click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        field = dialog.locator("textarea").first
        field.fill("e2e 已更新描述")
        # The dialog's submit is the shared "确认" label (common.confirm), not "保存".
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        deadline = time.time() + 30
        seen = ""
        while time.time() < deadline:
            seen = _description(ui, name)
            if seen == "e2e 已更新描述":
                break
            time.sleep(1)
        assert seen == "e2e 已更新描述", f"描述注解没有被更新：{seen!r}"

        # Delete through the same row: the confirmation is the object's name.
        _open_row_menu(ui, row)
        ui.page.get_by_role("menuitem", name="删除").click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        confirm.locator("input").first.fill(name)
        confirm.get_by_role("button", name="删除").click()
        expect(confirm).to_have_count(0, timeout=30_000)

        # Verify through the list, not the object read: this deployment answers a missing
        # object with 500 + plain text ("no matches" style) rather than 404, so "gone" has to
        # be read as "no longer in the collection".
        deadline = time.time() + 30
        remaining: list[str] = ["still-there"]
        while time.time() < deadline:
            status, body = ui.api.request("GET", f"{KAPIS}?name={quote(name)}")
            items = (body.get("items") if isinstance(body, dict) else None) or []
            remaining = [str((item.get("metadata") or {}).get("name")) for item in items]
            if status == 200 and not remaining:
                break
            time.sleep(1)
        assert not remaining, f"删除后对象仍然存在：{remaining}"
        screenshot(ui.page, "cluster-configmaps-writes")
    finally:
        _delete(ui, name)
