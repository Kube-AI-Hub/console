from __future__ import annotations

import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

BASE = "/api/v1/namespaces/default/secrets"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_LIST_03(secrets_page, session_token, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-LIST-03 保密字典列表的刷新与空态出口。"""

    from helpers.api import ApiClient

    api = ApiClient(secrets_page.base.split('/kube-frontend/')[0], session_token)
    name = f"tc-e2e-refresh-{uuid.uuid4().hex[:8]}"

    try:
        secrets_page.page.goto(secrets_page.list_url)
        surface = secrets_page.surface
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        refresh = secrets_page.page.locator('[data-ai-id="secrets:refresh"]')
        expect(refresh).to_be_visible(timeout=20_000)
        expect(secrets_page.page.locator(f'[data-ai-row="{name}"]')).to_have_count(0)

        status, body = api.request(
            "POST",
            BASE,
            {
                "apiVersion": "v1",
                "kind": "Secret",
                "metadata": {"name": name, "namespace": "default"},
                "type": "Opaque",
                "data": {"k": "dg=="},
            },
        )
        assert status in (200, 201), (status, body)
        refresh.click()
        expect(secrets_page.page.locator(f'[data-ai-row="{name}"]')).to_be_visible(timeout=30_000)

        # The empty state's refresh entry re-issues the request rather than doing nothing.
        search = secrets_page.page.locator('[data-ai-id="secrets:search"]').last
        search.fill("zzz-no-such-secret")
        expect(secrets_page.page.locator("[data-ai-row]")).to_have_count(0, timeout=30_000)
        empty_refresh = secrets_page.page.get_by_role("button", name="刷新")
        expect(empty_refresh.first).to_be_visible(timeout=20_000)
        empty_refresh.first.click()
        expect(secrets_page.surface).not_to_have_attribute("data-ai-state", "loading", timeout=30_000)
        screenshot(secrets_page.page, "secrets-refresh")
    finally:
        api.request("DELETE", f"{BASE}/{name}")
