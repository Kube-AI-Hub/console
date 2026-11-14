from __future__ import annotations

import re

import pytest
from playwright.sync_api import expect

from helpers.api import ApiClient

pytestmark = pytest.mark.ui

STORE = "/kapis/openpitrix.io/v1"


def _items(api, path: str) -> list[dict]:
    status, body = api.request("GET", path)
    assert status == 200 and isinstance(body, dict), f"{path} -> {status} {body}"
    return body.get("items") or []


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_STORE_DETAIL_01(page, ui_config, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01 应用详情：卡片进入、版本表、Readme、只读安装入口。"""

    api = ApiClient(ui_config.app, session_token)
    apps = _items(api, f"{STORE}/apps?limit=30&page=1")
    if not apps:
        pytest.skip("商店没有应用，无法核对详情")

    # Pick an app that actually has a version: the version table is part of this case.
    target = None
    versions: list[dict] = []
    for app in apps:
        version_items = _items(api, f"{STORE}/apps/{app['app_id']}/versions?limit=20&page=1")
        if version_items:
            target, versions = app, version_items
            break
    if target is None:
        pytest.skip("商店应用都没有版本，无法核对详情")

    app_id = target["app_id"]
    app_name = target.get("name") or app_id

    writes: list[str] = []
    page.on(
        "request",
        lambda request: writes.append(f"{request.method} {request.url}")
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and "openpitrix" in request.url
        else None,
    )

    # ---- list card -> detail ----
    page.goto(f"{ui_config.app}/kube-frontend/apps")
    surface = page.locator('[data-ai-id="app-store:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-ai-id="app-store:surface"]');
            return el && el.getAttribute('data-ai-state') !== 'loading';
        }""",
        timeout=60_000,
    )

    card = page.locator(f'[data-ai-id="app-store:card:{app_id}"]')
    expect(card).to_be_visible(timeout=30_000)
    card.click()

    expect(page).to_have_url(re.compile(re.escape(f"/kube-frontend/apps/{app_id}")), timeout=30_000)
    detail = page.locator('[data-ai-id="app-detail:surface"]')
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    expect(page.locator('[data-ai-id="app-detail:name"]')).to_contain_text(app_name, timeout=20_000)

    # ---- versions table: one row per API version, type from the app ----
    table = page.locator('[data-ai-id="app-detail:versions"]')
    expect(table).to_be_visible(timeout=20_000)
    expect(table.locator("tbody tr")).to_have_count(len(versions), timeout=20_000)
    first_version_name = str(versions[0].get("name") or "")
    if first_version_name:
        assert first_version_name in table.inner_text(), table.inner_text()[:300]

    # ---- install entry is disabled with an explanation, and does not write ----
    install = page.locator('[data-ai-id="app-detail:install-disabled"]')
    expect(install).to_be_visible(timeout=20_000)
    expect(install).to_be_disabled()
    assert "下一轮" in page.locator('[data-ai-id="app-detail:surface"]').inner_text()

    # ---- readme is collapsed by default, then decodes to non-empty text ----
    readme = page.locator('[data-ai-id="app-detail:readme"]')
    expect(readme).to_be_visible(timeout=20_000)
    page.locator('[data-ai-id="app-detail:readme-toggle"]').click()
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-ai-id="app-detail:readme"]');
            if (!el || !el.querySelector('pre')) return false;
            const pre = el.querySelector('pre');
            return pre && pre.innerText.trim().length > 20;
        }""",
        timeout=60_000,
    )
    decoded = readme.locator("pre").inner_text()
    assert len(decoded.strip()) > 20, decoded[:200]
    # The raw file is base64; decoded README text contains whitespace/newlines instead of a
    # single long base64 token. This catches rendering files["README.md"] verbatim.
    assert (" " in decoded) or ("\n" in decoded), decoded[:200]

    screenshot(page, "app-store-detail")

    # ---- unknown app id: a settled not-found, not a retry loop ----
    page.goto(f"{ui_config.app}/kube-frontend/apps/app-does-not-exist")
    not_found = page.locator('[data-ai-id="app-detail:not-found"]')
    expect(not_found).to_be_visible(timeout=30_000)
    assert page.locator('[data-ai-id="app-detail:retry"]').count() == 0, "not-found 不应显示重试按钮"

    # ---- the detail page is read-only ----
    assert writes == [], f"详情页发起了写请求: {writes}"
