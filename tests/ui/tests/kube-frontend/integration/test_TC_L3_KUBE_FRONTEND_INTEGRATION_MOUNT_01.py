"""同源集成：前缀挂载与静态分流。"""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _origin(ui_config) -> str:
    return ui_config.app.rstrip("/")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_INTEGRATION_MOUNT_01(ui_config, page, screenshot):
    """TC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01 静态资源与客户端路由分别响应。"""

    origin = _origin(ui_config)

    # 1. The shell names its assets with the prefix; take one and fetch it.
    shell = page.request.get(f"{origin}/kube-frontend/")
    assert shell.status == 200
    asset = re.search(r"/kube-frontend/assets/[^\"]+\.js", shell.text())
    assert asset, "the shell references no prefixed asset"

    asset_response = page.request.get(origin + asset.group(0))
    assert asset_response.status == 200, asset.group(0)
    assert "javascript" in (asset_response.headers.get("content-type") or "")
    # Hashed names are immutable; anything else means a reader keeps a stale build.
    assert "immutable" in (asset_response.headers.get("cache-control") or "")

    # 2. A client route is answered with the shell, not the old console's page.
    route = page.request.get(f"{origin}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps")
    assert route.status == 200
    assert "text/html" in (route.headers.get("content-type") or "")
    assert 'id="root"' in route.text()

    # 3. A missing asset must 404 — handing HTML to a script tag hides the cause.
    missing = page.request.get(f"{origin}/kube-frontend/assets/does-not-exist.js")
    assert missing.status == 404, missing.status

    # 4. An unknown path that explicitly wants JSON is not the shell either.
    json_want = page.request.get(f"{origin}/kube-frontend/no/such/route", headers={"accept": "application/json"})
    assert json_want.status == 404, json_want.status

    # 5. The bare paths still belong to the old console.
    for bare in ("/", "/login"):
        old = page.request.get(origin + bare)
        assert old.status == 200, bare
        # The old console's shell does not reference the new console's assets.
        assert "/kube-frontend/assets/" not in old.text(), bare

    screenshot(page, "integration-mount")
