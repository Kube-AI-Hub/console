from __future__ import annotations

import base64
import pathlib
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "public"
APPS = f"/kapis/openpitrix.io/v1/workspaces/{WS}/apps"
STORE_APPS = "/kapis/openpitrix.io/v1/apps"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_WORKSPACE_APPS_02(ui_config, page, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-WORKSPACE_APPS-02 企业空间应用模板：上传、版本状态机与删除。"""

    from conftest import ApiClient

    origin = ui_config.app
    api = ApiClient(origin, session_token)
    name = f"tc-e2e-tpl-{uuid.uuid4().hex[:8]}"
    package_path = pathlib.Path(f"/tmp/{name}.tgz")

    def template() -> dict:
        status, body = api.request("GET", f"{APPS}?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return {}
        for item in body.get("items") or []:
            if item.get("name") == name:
                return item
        return {}

    def versions(app_id: str) -> list[dict]:
        status, body = api.request("GET", f"{APPS}/{app_id}/versions?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("items") or []

    # 现成 chart 包：从商店里任一版本读回 base64，落到临时文件供 input[type=file] 使用。
    status, apps = api.request("GET", f"{STORE_APPS}?limit=-1")
    assert status == 200, f"store apps -> {status}"
    app_id = next((item.get("app_id") for item in (apps or {}).get("items") or [] if item.get("app_id")), "")
    assert app_id, "商店里没有可用于取包的应用"
    status, vers = api.request("GET", f"{STORE_APPS}/{app_id}/versions")
    version_id = ((vers or {}).get("items") or [{}])[0].get("version_id") or ""
    assert version_id, vers
    status, pkg = api.request("GET", f"{STORE_APPS}/{app_id}/versions/{version_id}/package")
    assert status == 200, f"package -> {status}"
    package_path.write_bytes(base64.b64decode((pkg or {}).get("package") or ""))

    try:
        page.goto(origin + f"/kube-frontend/workspaces/{WS}/apps")
        surface = page.locator('[data-ai-id="workspace-apps:surface"]').last
        expect(surface).to_be_visible(timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        page.locator('[data-ai-id="workspace-apps:create"]').click()
        dialog = page.get_by_role("dialog")
        expect(dialog).to_be_visible(timeout=20_000)
        page.locator('[data-ai-id="workspace-apps:create:name"]').fill(name)
        page.locator('[data-ai-id="workspace-apps:create:file"]').set_input_files(str(package_path))
        page.locator('[data-ai-id="workspace-apps:create:submit"]').click()
        expect(dialog).to_have_count(0, timeout=120_000)

        created = template()
        assert created.get("app_id"), "上传后接口未返回该模板"
        new_app_id = created["app_id"]

        # --- 版本状态机：draft → submitted → draft ---
        page.goto(origin + f"/kube-frontend/workspaces/{WS}/apps/{new_app_id}")
        expect(page.locator('[data-ai-id="workspace-app:surface"]').last).to_be_visible(timeout=60_000)
        rows = page.locator('[data-ai-id="workspace-app:versions"] tbody tr[data-ai-row]')
        expect(rows).to_have_count(len(versions(new_app_id)), timeout=60_000)

        row = rows.first
        row.get_by_role("button", name="更多操作").click()
        page.get_by_role("menuitem", name="提交审核").click()
        page.wait_for_timeout(3000)
        assert [v.get("status") for v in versions(new_app_id)] == ["submitted"], versions(new_app_id)

        rows = page.locator('[data-ai-id="workspace-app:versions"] tbody tr[data-ai-row]')
        rows.first.get_by_role("button", name="更多操作").click()
        page.get_by_role("menuitem", name="撤销提交").click()
        page.wait_for_timeout(3000)
        assert [v.get("status") for v in versions(new_app_id)] == ["draft"], versions(new_app_id)

        # --- 应用实例页签与接口一致 ---
        page.locator('[data-ai-id="workspace-app:tab:instances"]').click()
        expect(page.locator('[data-ai-id="workspace-app:instances"]')).to_be_visible(timeout=60_000)
        status, aggregate = api.request("GET", f"/kapis/openpitrix.io/v1/workspaces/{WS}/applications?limit=-1")
        expected = [
            item
            for item in (aggregate or {}).get("items") or []
            if (item.get("cluster") or {}).get("app_id") == new_app_id
        ]
        expect(page.locator('[data-ai-id="workspace-app:instances"] tbody tr[data-ai-row]')).to_have_count(
            len(expected), timeout=60_000
        )
        screenshot(page, "workspace-app-detail")

        # --- 有版本时删除模板被拦 ---
        page.locator('[data-ai-id="workspace-app:delete"]').click()
        expect(page.locator('[data-ai-id="workspace-app:delete-blocked"]')).to_be_visible(timeout=20_000)
        expect(page.locator('[data-ai-id="workspace-app:delete:confirm"]')).to_be_disabled()
        page.get_by_role("dialog").get_by_role("button", name="取消").click()

        # --- 删除版本 → 删除模板 ---
        page.locator('[data-ai-id="workspace-app:tab:versions"]').click()
        rows = page.locator('[data-ai-id="workspace-app:versions"] tbody tr[data-ai-row]')
        rows.first.get_by_role("button", name="更多操作").click()
        page.get_by_role("menuitem", name="删除版本").click()
        confirm = page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        page.locator('[data-ai-id="workspace-app-version:delete:confirm"]').click()
        expect(confirm).to_have_count(0, timeout=60_000)
        assert versions(new_app_id) == [], versions(new_app_id)

        page.locator('[data-ai-id="workspace-app:delete"]').click()
        confirm = page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        page.locator('[data-ai-id="workspace-app:delete:confirm"]').click()
        page.wait_for_timeout(3000)
        assert template() == {}, "模板删除后接口仍返回该对象"
    finally:
        found = template()
        if found.get("app_id"):
            for version in versions(found["app_id"]):
                api.request("DELETE", f"{APPS}/{found['app_id']}/versions/{version['version_id']}")
            api.request("DELETE", f"{APPS}/{found['app_id']}")
        package_path.unlink(missing_ok=True)
