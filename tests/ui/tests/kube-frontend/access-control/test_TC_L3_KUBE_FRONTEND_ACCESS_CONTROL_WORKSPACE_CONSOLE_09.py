from __future__ import annotations

import time
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui

WORKSPACE = "system-workspace"
CLUSTERS = f"/kapis/tenant.kubesphere.io/v1alpha2/workspaces/{WORKSPACE}/clusters?limit=-1"
DEVOPS_KAPIS = "/kapis/devops.kubesphere.io/v1alpha3"


def _workspace_clusters(api) -> list[dict]:
    status, body = api.request("GET", CLUSTERS)
    assert status == 200 and isinstance(body, dict), f"{CLUSTERS} -> {status}"
    return body.get("items") or []


def _devops_clusters(api) -> list[str]:
    names: list[str] = []
    for item in _workspace_clusters(api):
        status = item.get("status") or {}
        ready = any(
            str(condition.get("type")) == "Ready" and str(condition.get("status")) == "True"
            for condition in (status.get("conditions") or [])
        )
        configz = status.get("configz") or {}
        if ready and configz.get("devops") is True:
            names.append(str((item.get("metadata") or {}).get("name") or ""))
    return [name for name in names if name]


def _projects_of_cluster(api, cluster: str) -> list[dict]:
    path = (
        f"{DEVOPS_KAPIS}/workspaces/{WORKSPACE}/devops?limit=-1"
        if cluster == "host"
        else f"/kapis/clusters/{quote(cluster)}/devops.kubesphere.io/v1alpha3/workspaces/{WORKSPACE}/devops?limit=-1"
    )
    status, body = api.request("GET", path)
    if status != 200 or not isinstance(body, dict):
        return []
    return body.get("items") or []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_WORKSPACE_CONSOLE_09(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-09 企业空间 DevOps 入口与列表。"""

    ui = access_control_page
    assert ui.api is not None
    devops = DevopsPage(None, ui.base_url, "host", ui.api)  # type: ignore[arg-type]

    created = devops.create_project(
        workspace=WORKSPACE,
        alias="tc-e2e-ws-devops",
        description="工作空间 DevOps 入口用例",
    )
    name = str((created.get("metadata") or {}).get("name") or "")
    assert name, created
    try:
        expected_clusters = _devops_clusters(ui.api)
        expected: set[tuple[str, str]] = set()
        for cluster in expected_clusters:
            for item in _projects_of_cluster(ui.api, cluster):
                project = str((item.get("metadata") or {}).get("name") or "")
                if project:
                    expected.add((cluster, project))
        assert (("host", name) in expected) or (
            expected_clusters == [] and _projects_of_cluster(ui.api, "host")
        ), (name, expected_clusters, expected)

        # Enter from the workspace overview's sidebar: the entry is part of the task.
        ui.page.goto(
            f'{ui.base_url}/kube-frontend/workspaces/{WORKSPACE}/overview',
            wait_until="domcontentloaded",
        )
        entry = ui.page.locator(f'a[href$="/workspaces/{WORKSPACE}/devops"]').first
        expect(entry).to_be_visible(timeout=60_000)
        entry.click()

        surface = ui.page.locator('[data-ai-id="workspace-devops:surface"]')
        expect(surface).to_be_visible(timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        state = surface.get_attribute("data-ai-state")
        assert state in ("ready", "empty"), state

        if state == "empty":
            wrapper = ui.page.locator('[data-ai-id="workspace-devops:empty-no-devops"]')
            if wrapper.count() == 0:
                expect(ui.page.get_by_text("还没有 DevOps 工程").first).to_be_visible(timeout=20_000)
        else:
            rows = surface.locator("[data-ai-row]")
            visible = set(tuple(str(value).split("/", 1)) for value in rows.evaluate_all(
                "els => els.map(e => e.getAttribute('data-ai-row'))"
            ))
            # The page must not invent rows or drop clusters: every row comes from a
            # workspace aggregate, and the temporary project is in the host aggregate.
            assert visible == expected, (visible, expected)

        # The row links to the project's cluster-scoped detail, where create/edit live.
        link = ui.page.locator(f'[data-ai-id="workspace-devops:link:host:{name}"]')
        if link.count():
            expect(link).to_be_visible(timeout=20_000)
            href = link.get_attribute("href") or ""
            assert href.endswith(f"/kube-frontend/clusters/host/devops/{name}"), href

            # Search narrows to the new project (name/alias match).
            search = ui.page.locator('[data-ai-id="workspace-devops:search"]')
            if search.count():
                search.fill("tc-e2e-ws-devops")
                ui.page.wait_for_timeout(600)
                expect(ui.page.locator(f'[data-ai-id="workspace-devops:link:host:{name}"]')).to_be_visible(timeout=20_000)
                search.fill("")

        screenshot(ui.page, "workspace-devops")

        # Removing the only project must land on the "no projects" empty state, not an
        # empty table with no explanation (reading the page after the write is also how a
        # workspace admin learns the delete worked).
        _remove(devops, ui.api, created, name)
        ui.page.reload(wait_until="domcontentloaded")
        surface = ui.page.locator('[data-ai-id="workspace-devops:surface"]')
        expect(surface).to_be_visible(timeout=60_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
        expect(ui.page.get_by_text("还没有 DevOps 工程").first).to_be_visible(timeout=20_000)
        expect(ui.page.locator(f'[data-ai-id="workspace-devops:link:host:{name}"]')).to_have_count(0, timeout=20_000)
    finally:
        _remove(devops, ui.api, created, name)


def _remove(devops: DevopsPage, api, created: dict, name: str) -> None:
    """Delete the temporary project, its finalizer and the namespace it created."""
    for _ in range(5):
        if not devops.project_exists(name):
            break
        devops.force_remove_project(name)
    namespace = str((created.get("status") or {}).get("adminNamespace") or "") or name
    # The controller may create the project namespace a moment after the object; give
    # it a beat before deciding there is nothing to remove, so the case is self-cleaning.
    for _ in range(6):
        status, _ = api.request("GET", f"/api/v1/namespaces/{quote(namespace)}")
        if status == 200:
            break
        time.sleep(1)
    status, _ = api.request("DELETE", f"/api/v1/namespaces/{quote(namespace)}")
    assert status in (200, 202, 404), status
