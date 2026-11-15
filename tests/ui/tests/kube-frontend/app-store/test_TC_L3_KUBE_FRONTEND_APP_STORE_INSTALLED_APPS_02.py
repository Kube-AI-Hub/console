from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WS = "public"
NS = "csghub"
AGGREGATE = f"/kapis/openpitrix.io/v1/workspaces/{WS}/applications"
PROJECT = f"/kapis/openpitrix.io/v1/workspaces/{WS}/namespaces/{NS}/applications"
RELEASES = "/apis/application.kubesphere.io/v1alpha1/helmreleases"
VALUES_KEY = "replicaCount"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_INSTALLED_APPS_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-INSTALLED_APPS-02 已安装应用：详情五页签与卸载。"""

    ui = app_workloads_page
    assert ui.api is not None
    release = f"tc-e2e-rel-{uuid.uuid4().hex[:8]}"
    origin = ui.base.split("/kube-frontend/")[0]

    def rows() -> list[dict]:
        status, body = ui.api.request("GET", f"{AGGREGATE}?limit=-1")
        if status != 200 or not isinstance(body, dict):
            return []
        return body.get("items") or []

    def mine() -> dict:
        for item in rows():
            cluster = item.get("cluster") or {}
            if cluster.get("name") == release:
                return cluster
        return {}

    def wait_gone(timeout: float = 90.0) -> bool:
        """Poll until the release disappears from both the aggregate and the CRD collection.

        Uninstalling is asynchronous: the DELETE answers 200 immediately, then the controller
        removes the HelmRelease and the aggregate row. Asserting straight after the click fails
        on a healthy system (measured: gone within a couple of minutes), so the test waits.
        """
        deadline = time.time() + timeout
        while time.time() < deadline:
            if not mine() and release_id not in release_ids():
                return True
            time.sleep(3)
        return not mine() and release_id not in release_ids()

    def release_ids() -> set[str]:
        status, body = ui.api.request("GET", RELEASES)
        if status != 200 or not isinstance(body, dict):
            return set()
        return {
            (item.get("metadata") or {}).get("name") or ""
            for item in body.get("items") or []
        }

    try:
        # 选一个带 active 版本的最小 chart（MySQL Exporter：单 Deployment + Service）。
        status, apps = ui.api.request("GET", "/kapis/openpitrix.io/v1/apps?limit=-1")
        assert status == 200, f"store apps -> {status}"
        candidates = [item for item in (apps or {}).get("items") or [] if item.get("app_id") and "exporter" in str(item.get("name", "")).lower()]
        app = candidates[0] if candidates else ((apps or {}).get("items") or [{}])[0]
        app_id = app.get("app_id") or ""
        assert app_id, apps
        status, versions = ui.api.request("GET", f"/kapis/openpitrix.io/v1/apps/{app_id}/versions")
        version_id = ((versions or {}).get("items") or [{}])[0].get("version_id") or ""
        assert version_id, versions

        conf = f"{VALUES_KEY}: 1\n"
        status, body = ui.api.request(
            "POST",
            PROJECT,
            {
                "app_id": app_id,
                "version_id": version_id,
                "name": release,
                "description": "e2e installed app",
                "conf": conf,
            },
        )
        assert status == 200, f"install -> {status}: {body}"

        deadline = time.time() + 90
        cluster_row: dict = {}
        while time.time() < deadline:
            cluster_row = mine()
            if cluster_row.get("cluster_id"):
                break
            time.sleep(2)
        release_id = cluster_row.get("cluster_id") or ""
        assert release_id.startswith("rls-"), cluster_row
        assert release_id in release_ids(), "helmrelease 对象未创建"

        # --- 详情：基本信息 ---
        ui.page.goto(f"{origin}/kube-frontend/workspaces/{WS}/apps/instances/{release_id}")
        surface = ui.page.locator('[data-ai-id="installed-app:surface"]').last
        expect(surface).to_be_visible(timeout=60_000)
        expect(ui.page.locator('[data-ai-id="installed-app:name"]')).to_have_text(release, timeout=60_000)
        basic = ui.page.locator('[data-ai-id="installed-app:basic"]')
        expect(basic).to_be_visible()
        text = basic.inner_text()
        assert NS in text and release in text
        expect(ui.page.locator('[data-ai-id="installed-app:upgrade-note"]')).to_be_visible()

        # --- 资源页签：按选择器查询，允许 0 条（chart 可能尚未创建完） ---
        ui.page.locator('[data-ai-id="installed-app:tab:resources"]').click()
        resources = ui.page.locator('[data-ai-id="installed-app:resources"]')
        expect(resources).to_be_visible(timeout=60_000)

        # --- 事件页签 ---
        ui.page.locator('[data-ai-id="installed-app:tab:events"]').click()
        expect(ui.page.locator('[data-ai-id="installed-app:events"]')).to_be_visible(timeout=60_000)

        # --- 配置页签：values 与提交内容一致 ---
        ui.page.locator('[data-ai-id="installed-app:tab:config"]').click()
        config = ui.page.locator('[data-ai-id="installed-app:config"]')
        expect(config).to_be_visible(timeout=60_000)
        assert VALUES_KEY in config.inner_text()

        # --- YAML 页签 ---
        ui.page.locator('[data-ai-id="installed-app:tab:yaml"]').click()
        yaml_panel = ui.page.locator('[data-ai-id="installed-app:yaml"]')
        expect(yaml_panel).to_be_visible(timeout=60_000)
        assert release_id in yaml_panel.inner_text()
        screenshot(ui.page, "installed-app-detail")

        # --- 卸载：必须用 rls-id ---
        ui.page.locator('[data-ai-id="installed-app:uninstall"]').click()
        confirm = ui.page.get_by_role("dialog")
        expect(confirm).to_be_visible(timeout=20_000)
        deletes: list[str] = []
        ui.page.on(
            "request",
            lambda request: deletes.append(request.url)
            if request.method == "DELETE" and "/applications/" in request.url
            else None,
        )
        ui.page.locator('[data-ai-id="installed-app:uninstall:confirm"]').click()
        ui.page.wait_for_timeout(4000)
        assert any(url.rstrip("/").endswith(release_id) for url in deletes), deletes
        assert wait_gone(), f"卸载后仍残留 release：{mine()}"
    finally:
        current = mine()
        if current.get("cluster_id"):
            ui.api.request("DELETE", f"{PROJECT}/{current['cluster_id']}")
        # The delete is asynchronous, so the cleanup waits for the same condition the test does.
        assert wait_gone(), f"清理后仍残留 release：{mine()}"