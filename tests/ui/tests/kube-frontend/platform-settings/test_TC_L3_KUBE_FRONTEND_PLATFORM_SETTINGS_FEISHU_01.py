from __future__ import annotations

import base64

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

V2 = "/kapis/notification.kubesphere.io/v2beta2"
V1 = "/kapis/notification.kubesphere.io/v2beta1"
OBJECTS = {
    "config": f"{V2}/configs/default-feishu-config",
    "receiver": f"{V2}/receivers/global-feishu-receiver",
    "secret": f"{V1}/secrets/global-feishu-config-secret",
}

#: The fields each mode puts on the page, and the fields it must hide.
MODE_FIELDS = {
    "user": {
        "visible": ("appkey", "appsecret", "users"),
        "hidden": ("departments", "webhook", "chatbotsecret", "keywords"),
    },
    "department": {
        "visible": ("appkey", "appsecret", "departments"),
        "hidden": ("users", "webhook", "chatbotsecret", "keywords"),
    },
    "chatbot": {
        "visible": ("webhook", "chatbotsecret", "keywords"),
        "hidden": ("appkey", "appsecret", "users", "departments"),
    },
}


def _cleanup(api) -> None:
    """Leave the platform without a Feishu channel, as it was found."""
    for path in OBJECTS.values():
        status, _ = api.request("DELETE", path)
        assert status in (200, 404), f"cleanup failed for {path}: {status}"


def _set_mode(page, mode: str) -> None:
    page.locator("#ai-field-feishu-mode").select_option(value=mode)
    expect(page.locator("#ai-field-feishu-mode")).to_have_value(mode)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PLATFORM_SETTINGS_FEISHU_01(platform_settings_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-FEISHU-01 飞书渠道：字段、空态与保存。"""

    app = ui_config.app
    page = platform_settings_page.page
    api = platform_settings_page.api
    assert api is not None

    try:
        # ---- 页面结构与空态（不依赖任何写入） ----
        page.goto(f"{app}/kube-frontend/settings/feishu")
        surface = page.locator('[data-ai-id="notification-feishu:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        # The channel page rather than an empty shell: its name and the enabled switch exist.
        expect(page.locator('[data-ai-id="notification-feishu:enabled"]')).to_be_visible()
        # Nothing has been saved on this cluster, so the badge must say so explicitly.
        expect(surface).to_contain_text("未配置", timeout=30_000)

        # Default mode is the application/user mode, and only that mode's fields are drawn.
        expect(page.locator("#ai-field-feishu-mode")).to_have_value("user")
        for mode, fields in MODE_FIELDS.items():
            _set_mode(page, mode)
            for field in fields["visible"]:
                expect(page.locator(f"#ai-field-feishu-{field}")).to_be_visible()
            for field in fields["hidden"]:
                expect(page.locator(f"#ai-field-feishu-{field}")).to_have_count(0)

        # ---- 校验在发请求之前拦下 ----
        writes: list[str] = []
        page.on(
            "request",
            lambda request: writes.append(request.method)
            if request.method in ("POST", "PUT") and "notification" in request.url
            else None,
        )
        _set_mode(page, "chatbot")
        page.locator('[data-ai-id="notification-feishu:save"]').click()
        page.wait_for_timeout(800)
        alerts = role_alerts(page)
        assert alerts, "Webhook 为空却没有提示"
        assert writes == [], f"校验未拦截就发出了写入请求 {writes}"

        # ---- 保存（依赖平台通知组件可用） ----
        #
        # Creating a Config goes through the notification manager's validating webhook.
        # When that webhook is unreachable the API answers 400 after its 10s timeout, which
        # is an environment fault — say so instead of reporting a product failure.
        _set_mode(page, "user")
        page.fill("#ai-field-feishu-appkey", "cli_feishu_test")
        page.fill("#ai-field-feishu-appsecret", "feishu-test-secret")
        page.fill("#ai-field-feishu-users", "ou_test_user_1, ou_test_user_2")
        page.locator('[data-ai-id="notification-feishu:save"]').click()

        error = page.locator('[data-ai-id="notification-feishu:save-error"]')
        try:
            expect(error).to_be_visible(timeout=25_000)
            text = error.inner_text()
            if "webhook" in text or "notification-manager" in text:
                screenshot(page, "feishu-channel-fields")
                pytest.skip(f"平台通知组件的校验 webhook 不可用，无法验证写入：{text[:160]}")
            pytest.fail(f"飞书渠道保存失败：{text[:300]}")
        except AssertionError:
            # No error element appeared: the save is either in flight or done.
            pass

        page.wait_for_function(
            """() => !document.querySelector('[data-ai-id="notification-feishu:save"]')?.hasAttribute('data-loading')""",
            timeout=60_000,
        )
        if error.count() and error.is_visible():
            text = error.inner_text()
            if "webhook" in text or "notification-manager" in text:
                screenshot(page, "feishu-channel-fields")
                pytest.skip(f"平台通知组件的校验 webhook 不可用，无法验证写入：{text[:160]}")
            pytest.fail(f"飞书渠道保存失败：{text[:300]}")

        # Read all three objects back: "the button stopped spinning" is not evidence.
        status, config = api.request("GET", OBJECTS["config"])
        assert status == 200, "飞书渠道保存后没有 Config"
        feishu_config = (config.get("spec") or {}).get("feishu") or {}
        assert feishu_config.get("appID", {}).get("valueFrom", {}).get("secretKeyRef", {}).get("key") == "appkey"
        assert feishu_config.get("appSecret", {}).get("valueFrom", {}).get("secretKeyRef", {}).get("key") == "appsecret"

        status, receiver = api.request("GET", OBJECTS["receiver"])
        assert status == 200, "飞书渠道保存后没有 Receiver"
        feishu_receiver = (receiver.get("spec") or {}).get("feishu") or {}
        assert feishu_receiver.get("user") == ["ou_test_user_1", "ou_test_user_2"], feishu_receiver
        assert feishu_receiver.get("enabled") is False

        status, secret = api.request("GET", OBJECTS["secret"])
        assert status == 200, "飞书渠道保存后没有 Secret"
        secret_data = secret.get("data") or {}
        # Secrets store base64; compare what was written, not the encoding.
        assert base64.b64decode(secret_data.get("appkey", "")) == b"cli_feishu_test"
        assert base64.b64decode(secret_data.get("appsecret", "")) == b"feishu-test-secret"

        # Reload: the page must render what was saved, and infer the user mode from the
        # receiver rather than falling back to the first tab.
        page.reload()
        surface = page.locator('[data-ai-id="notification-feishu:surface"]')
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
        expect(surface).to_contain_text("已配置", timeout=30_000)
        expect(page.locator("#ai-field-feishu-mode")).to_have_value("user")
        expect(page.locator("#ai-field-feishu-users")).to_have_value("ou_test_user_1, ou_test_user_2")
        screenshot(page, "feishu-channel-saved")
    finally:
        _cleanup(api)


def role_alerts(page) -> str:
    return " ".join(page.locator('[role="alert"]').all_inner_texts())
