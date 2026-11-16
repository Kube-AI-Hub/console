from __future__ import annotations

import re
import time
import uuid

import pytest
from playwright.sync_api import expect

from helpers.api import ApiClient

pytestmark = pytest.mark.ui

STORE = "/kapis/openpitrix.io/v1"
TENANT = "/kapis/tenant.kubesphere.io/v1alpha2"
PREFIX = "tc-e2e-install-"


def _items(api, path: str) -> list[dict]:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status}: {str(body)[:300]}"
    return body.get("items") or []


def _applications(api, workspace: str, project: str) -> list[dict]:
    path = f"{STORE}/workspaces/{workspace}/namespaces/{project}/applications?limit=-1"
    return _items(api, path)


def _release_name(item: dict) -> str:
    return str(((item.get("cluster") or {}).get("name")) or "")


def _release_id(item: dict) -> str:
    return str(((item.get("cluster") or {}).get("cluster_id")) or "")


def _select(page, trigger_id: str, contains: str) -> None:
    page.locator(f'[data-ai-id="{trigger_id}"]').click()
    option = page.locator('[role="option"]').filter(has_text=contains).first
    expect(option).to_be_visible(timeout=20_000)
    option.click()


def _cleanup(api, workspace: str, project: str, release: str) -> None:
    """Delete the release by object id and wait until the list no longer has it."""
    path = f"{STORE}/workspaces/{workspace}/namespaces/{project}/applications"
    deadline = time.time() + 90
    while time.time() < deadline:
        matches = [item for item in _applications(api, workspace, project) if _release_name(item) == release]
        if not matches:
            break
        for item in matches:
            release_id = _release_id(item)
            if release_id:
                status, body = api.request("DELETE", f"{path}/{release_id}")
                assert status in (200, 404), f"DELETE {release_id} -> {status}: {str(body)[:200]}"
        time.sleep(2)
    leftovers = [item for item in _applications(api, workspace, project) if _release_name(item).startswith(PREFIX)]
    assert leftovers == [], f"清理后仍有 {PREFIX} release: {[_release_name(item) for item in leftovers]}"


def _pick_target(api) -> tuple[str, str]:
    workspaces = _items(api, f"{TENANT}/workspaces?limit=-1")
    assert workspaces, "没有可用的企业空间"
    pairs: list[tuple[str, str]] = []
    for workspace in workspaces:
        name = str((workspace.get("metadata") or {}).get("name") or "")
        if not name:
            continue
        projects = _items(api, f"{TENANT}/workspaces/{name}/namespaces?limit=-1")
        for project in projects:
            project_name = str((project.get("metadata") or {}).get("name") or "")
            if project_name:
                pairs.append((name, project_name))
    assert pairs, "没有可安装的项目"
    # Prefer a stable target; any pair works, but stability matters for a write case.
    # `public` currently has no projects on this deployment (its former `spaces`/`csghub`
    # projects were removed), and installing into a system namespace is not representative,
    # so fall back to system-workspace's `default` before taking whatever comes first.
    for preferred in (("public", "spaces"), ("public", "csghub"), ("system-workspace", "default")):
        if preferred in pairs:
            return preferred
    return pairs[0]


def _pick_app(api) -> tuple[str, str]:
    apps = _items(api, f"{STORE}/apps?limit=30&page=1")
    assert apps, "商店没有应用"
    candidates: list[tuple[str, str, str]] = []
    for app in apps:
        versions = _items(api, f"{STORE}/apps/{app['app_id']}/versions?limit=20&page=1")
        active = [version for version in versions if version.get("status") == "active"]
        if not active:
            continue
        candidates.append((str(app.get("name") or ""), str(app["app_id"]), str(active[0]["version_id"])))
    assert candidates, "没有带 active 版本的应用"
    preferred_names = ("Memcached", "Redis Exporter", "Tomcat", "etcd", "NGINX")
    for name in preferred_names:
        for candidate in candidates:
            if candidate[0].lower() == name.lower():
                return candidate[1], candidate[2]
    return candidates[0][1], candidates[0][2]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_INSTALL_01(page, ui_config, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01 从详情安装一个应用并在结束时清理 release。"""

    api = ApiClient(ui_config.app, session_token)
    workspace, project = _pick_target(api)
    app_id, version_id = _pick_app(api)
    release = f"{PREFIX}{uuid.uuid4().hex[:8]}"
    base = f"{STORE}/workspaces/{workspace}/namespaces/{project}/applications"

    writes: list[str] = []
    page.on(
        "request",
        lambda request: writes.append(f"{request.method} {request.url}")
        if request.method == "POST" and "openpitrix" in request.url
        else None,
    )

    created = False
    try:
        page.goto(f"{ui_config.app}/kube-frontend/apps/{app_id}")
        detail = page.locator('[data-ai-id="app-detail:surface"]')
        expect(detail).to_be_visible(timeout=30_000)
        expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        page.locator('[data-ai-id="app-detail:install"]').click()
        dialog = page.locator('[data-ai-id="app-detail:install-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)

        # The dialog preselects the first workspace/project; pick the known target explicitly
        # so the case does not depend on list order.
        expect(page.locator('[data-ai-id="app-detail:install-workspace"]')).to_be_visible(timeout=30_000)
        _select(page, "app-detail:install-workspace", workspace)
        expect(page.locator('[data-ai-id="app-detail:install-project"]')).to_be_visible(timeout=30_000)
        _select(page, "app-detail:install-project", project)

        page.locator('[data-ai-id="app-detail:install-name"]').fill(release)
        page.locator('[data-ai-id="app-detail:install-submit"]').click()

        outcome = page.locator(
            '[data-ai-id="app-detail:install-success"], [data-ai-id="app-detail:install-error"]'
        ).first
        expect(outcome).to_be_visible(timeout=120_000)
        if page.locator('[data-ai-id="app-detail:install-error"]').count():
            message = page.locator('[data-ai-id="app-detail:install-error"]').inner_text()
            raise AssertionError(f"安装被服务端拒绝: {message}")
        success = page.locator('[data-ai-id="app-detail:install-success"]')
        expect(success).to_contain_text(release, timeout=30_000)
        expect(page.locator('[data-ai-id="app-detail:install-success-link"]')).to_be_visible()
        screenshot(page, "app-store-install")

        # The release is created asynchronously with respect to the response; wait for its row.
        found_id = ""
        deadline = time.time() + 120
        while time.time() < deadline:
            matches = [item for item in _applications(api, workspace, project) if _release_name(item) == release]
            if matches:
                found_id = _release_id(matches[0])
                break
            time.sleep(2)
        assert found_id, f"{workspace}/{project} 的 applications 里没有出现 release {release}"
        created = True

        # Same name in the same project must be rejected before the write, not by a server 500.
        # The dialog resets on every open, so the target pair is chosen again here: its default is
        # the first workspace, which on this deployment can be one without any project.
        page.locator('[data-ai-id="app-detail:install-close"]').click()
        page.locator('[data-ai-id="app-detail:install"]').click()
        expect(page.locator('[data-ai-id="app-detail:install-dialog"]')).to_be_visible(timeout=20_000)
        _select(page, "app-detail:install-workspace", workspace)
        expect(page.locator('[data-ai-id="app-detail:install-project"]')).to_be_visible(timeout=30_000)
        _select(page, "app-detail:install-project", project)
        page.locator('[data-ai-id="app-detail:install-name"]').fill(release)
        page.locator('[data-ai-id="app-detail:install-submit"]').click()
        expect(page.locator('[data-ai-id="app-detail:install-error"]')).to_contain_text("同名", timeout=30_000)
        duplicates = [item for item in _applications(api, workspace, project) if _release_name(item) == release]
        assert len(duplicates) == 1, f"同名安装产生了 {len(duplicates)} 个 release"

        creates = [entry for entry in writes if base in entry]
        assert len(creates) == 1, f"期望一次创建请求，实际 {creates}"
    finally:
        _cleanup(api, workspace, project, release)
        if not created:
            # A failed run must not leave a half-created release behind either.
            assert not [item for item in _applications(api, workspace, project) if _release_name(item) == release]
