"""Fixtures for the cluster-management cases.

The devops write cases need one *real* DevOps project. A fresh install has none
(verified 2026-11-15 on B200: /apis/devops.kubesphere.io/v1alpha3/devopsprojects
answered 200 with items=[]), so these cases used to skip there and only pass while
some leftover project happened to exist. A case that skips because of cluster
leftovers is not a passing case, so the fixture creates a project when needed and
removes it again (finalizer included).
"""

from __future__ import annotations

import time
from typing import Iterator

import pytest

from helpers.config import UiConfig
from pages.devops_page import DevopsPage


@pytest.fixture(scope="session")
def devops_project(ui_config: UiConfig, session_token: str) -> Iterator[tuple[str, str]]:
    """(project name, admin namespace) of a DevOps project the devops cases may write to."""
    from helpers.api import ApiClient

    api = ApiClient(ui_config.app, session_token)
    devops = DevopsPage(None, ui_config.app, ui_config.cluster, api)  # type: ignore[arg-type]
    existing = devops.pick_container()
    if existing is not None:
        yield existing
        return

    created = devops.create_project()
    name = str((created.get("metadata") or {}).get("name") or "")
    assert name, f"create project returned no name: {str(created)[:300]}"
    try:
        # A project is only usable once the controller fills status.adminNamespace AND the
        # namespace exists. Do not fall back to the project name: on an install whose devops
        # controller crash-loops (BLOCK-1: Jenkins token) no namespace is ever created, and
        # the writes then fail with "an empty namespace may not be set during creation".
        namespace = ""
        for _ in range(60):
            item = devops.project(name)
            namespace = str((item.get("status") or {}).get("adminNamespace") or "")
            if namespace and devops.namespace_exists(namespace):
                break
            namespace = ""
            time.sleep(1)
        if not namespace:
            pytest.skip(
                "devops-controller 未给新建工程准备命名空间（BLOCK-1 Jenkins 令牌不匹配），"
                "本集群也没有可复用的 DevOps 工程；写入类用例需要可用工程才能验证",
            )
        yield name, namespace
    finally:
        devops.delete_project_quiet(name)
        # The controller owns the delete finalizer; on this install it crash-loops on the
        # Jenkins token, so clear it explicitly and drop the namespace it created.
        for _ in range(10):
            if not devops.project_exists(name):
                break
            devops.force_remove_project(name)
            time.sleep(1)
