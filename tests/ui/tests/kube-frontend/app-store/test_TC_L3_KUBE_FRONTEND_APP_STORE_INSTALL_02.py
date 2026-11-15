from __future__ import annotations

import base64

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

STORE_APPS = "/kapis/openpitrix.io/v1/apps"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_INSTALL_02(ui_config, page, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02 应用详情 · 安装弹窗的 values 配置。"""

    from conftest import ApiClient

    origin = ui_config.app
    api = ApiClient(origin, session_token)

    status, apps = api.request("GET", f"{STORE_APPS}?limit=-1")
    assert status == 200, f"store apps -> {status}"
    app = next((item for item in (apps or {}).get("items") or [] if item.get("app_id")), None)
    assert app is not None, "商店里没有应用"
    app_id = app["app_id"]

    status, versions = api.request("GET", f"{STORE_APPS}/{app_id}/versions")
    version_id = ((versions or {}).get("items") or [{}])[0].get("version_id") or ""
    assert version_id, versions

    status, files = api.request("GET", f"{STORE_APPS}/{app_id}/versions/{version_id}/files")
    assert status == 200, f"files -> {status}"
    raw_values = ((files or {}).get("files") or {}).get("values.yaml") or ""
    assert raw_values, "该版本没有 values.yaml，用例前提不成立"
    expected_values = base64.b64decode(raw_values).decode("utf-8", "replace")

    writes: list[str] = []
    page.on(
        "request",
        lambda request: writes.append(f"{request.method} {request.url}")
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and "openpitrix" in request.url
        else None,
    )

    page.goto(origin + f"/kube-frontend/apps/{app_id}")
    expect(page.locator('[data-ai-id="app-detail:surface"]').last).to_be_visible(timeout=60_000)
    page.locator('[data-ai-id="app-detail:install"]').click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=30_000)

    values = page.locator('[data-ai-id="app-detail:install-values"]')
    expect(values).to_be_visible(timeout=60_000)
    # 预填值来自该版本 chart 的 values.yaml（解码后）。
    expect(values).to_have_value(expected_values, timeout=60_000)
    screenshot(page, "app-install-values")

    # 编辑后「恢复默认」回到 chart 原值。
    values.fill("replicaCount: 2\n")
    page.locator('[data-ai-id="app-detail:install-values-reset"]').click()
    expect(values).to_have_value(expected_values, timeout=30_000)

    # 清空后仍可提交（使用 chart 默认值），但本用例只读，不提交。
    values.fill("")
    expect(page.locator('[data-ai-id="app-detail:install-submit"]')).to_be_enabled()
    page.locator('[data-ai-id="app-detail:install-cancel"]').click()
    expect(dialog).to_have_count(0, timeout=30_000)

    assert writes == [], f"打开/取消安装弹窗不应产生写请求：{writes}"
