"""Shared plumbing for the project-scoped application cases."""

from __future__ import annotations

import time
import uuid

STORE = "/kapis/openpitrix.io/v1"
WS = "system-workspace"
PROJECT = "default"
PREFIX = "tc-e2e-projapp-"


def items(api, path: str) -> list[dict]:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status}: {str(body)[:300]}"
    return body.get("items") or []


def releases(api, workspace: str = WS, project: str = PROJECT) -> list[dict]:
    return items(api, f"{STORE}/workspaces/{workspace}/namespaces/{project}/applications?limit=-1")


def release_name(item: dict) -> str:
    return str(((item.get("cluster") or {}).get("name")) or "")


def release_id(item: dict) -> str:
    return str(((item.get("cluster") or {}).get("cluster_id")) or "")


def unique_name() -> str:
    return f"{PREFIX}{uuid.uuid4().hex[:8]}"


def installable_app(api) -> tuple[str, str]:
    """(app_id, version_id) of a store application with at least one version."""
    apps = items(api, f"{STORE}/apps?limit=-1")
    assert apps, "商店没有应用"
    for app in apps:
        app_id = str(app.get("app_id") or "")
        if not app_id:
            continue
        versions = items(api, f"{STORE}/apps/{app_id}/versions")
        version_id = str((versions[0] if versions else {}).get("version_id") or "")
        if version_id:
            return app_id, version_id
    raise AssertionError("商店里没有可安装的版本")


def create_release(api, name: str) -> None:
    app_id, version_id = installable_app(api)
    body = {"app_id": app_id, "version_id": version_id, "name": name, "conf": "replicaCount: 1\n"}
    status, created = api.request("POST", f"{STORE}/workspaces/{WS}/namespaces/{PROJECT}/applications", body)
    assert status in (200, 201), f"create release -> {status}: {str(created)[:300]}"


def remove_release(api, name: str) -> None:
    """Delete by object id and wait until the collection stops returning it (deletion is async)."""
    path = f"{STORE}/workspaces/{WS}/namespaces/{PROJECT}/applications"
    deadline = time.time() + 90
    while time.time() < deadline:
        matches = [item for item in releases(api) if release_name(item) == name]
        if not matches:
            return
        for item in matches:
            rid = release_id(item)
            if rid:
                api.request("DELETE", f"{path}/{rid}")
        time.sleep(2)
    raise AssertionError(f"release {name} 在 90s 内没有被删除")


def sweep(api) -> None:
    """Remove any case-prefixed leftovers (a failed run must not poison the next one)."""
    for item in releases(api):
        name = release_name(item)
        if name.startswith(PREFIX):
            try:
                remove_release(api, name)
            except AssertionError:
                pass
