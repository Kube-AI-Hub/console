from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

V2 = "/kapis/notification.kubesphere.io/v2beta2"
V1 = "/kapis/notification.kubesphere.io/v2beta1"

#: channel → the objects it owns. The mail case covers mail, so this file covers the rest.
CHANNELS = {
    "dingtalk": {
        "config": f"{V2}/configs/default-dingtalk-config",
        "receiver": f"{V2}/receivers/global-dingtalk-receiver",
        "secret": f"{V1}/secrets/global-dingtalk-config-secret",
        "fields": ["mode", "appkey", "appsecret", "chatids"],
        "values": {"appkey": "dingkey", "appsecret": "dingsecret", "chatids": "cid-1, cid-2"},
        "expect": {"secret": "appsecret", "receiver": "dingtalk"},
    },
    "wecom": {
        "config": f"{V2}/configs/default-wechat-config",
        "receiver": f"{V2}/receivers/global-wechat-receiver",
        "secret": f"{V1}/secrets/global-wechat-config-secret",
        "fields": ["corpId", "agentId", "appsecret", "mode", "recipients"],
        "values": {"corpId": "corp-1", "agentId": "1000002", "appsecret": "wecomsecret", "recipients": "u1, u2"},
        "expect": {"secret": "appsecret", "receiver": "wechat"},
    },
    "slack": {
        "config": f"{V2}/configs/default-slack-config",
        "receiver": f"{V2}/receivers/global-slack-receiver",
        "secret": f"{V1}/secrets/global-slack-config-token",
        "fields": ["token", "channels"],
        "values": {"token": "xoxb-test-token", "channels": "#ops, #dev"},
        "expect": {"secret": "token", "receiver": "slack"},
    },
    "webhook": {
        # Webhook has no Config object at all: everything lives in the Receiver.
        "config": None,
        "receiver": f"{V2}/receivers/global-webhook-receiver",
        "secret": f"{V1}/secrets/global-webhook-config-secret",
        "fields": ["url", "auth", "skipVerify"],
        "values": {"url": "https://example.com/hook", "token": "bearer-1"},
        "expect": {"secret": "token", "receiver": "webhook"},
    },
}


def _cleanup(api, channel: dict) -> None:
    for key in ("config", "secret", "receiver"):
        path = channel[key]
        if not path:
            continue
        status, _ = api.request("DELETE", path)
        assert status in (200, 404), f"cleanup failed for {path}: {status}"


@pytest.mark.point
@pytest.mark.parametrize("name", list(CHANNELS))
def test_TC_L3_KUBE_FRONTEND_PLATFORM_SETTINGS_CHANNELS_01(
    platform_settings_page, ui_config, screenshot, name
):
    """TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-CHANNELS-01 其余四个渠道：字段、保存与校验。"""

    channel = CHANNELS[name]
    page = platform_settings_page.page
    api = platform_settings_page.api
    app = ui_config.app

    page.goto(f"{app}/kube-frontend/settings/{name}")
    surface = page.locator(f'[data-ai-id="notification-{name}:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # Every field the channel declares is present, and the page names the channel rather
    # than rendering an empty shell.
    for field in channel["fields"]:
        expect(page.locator(f"#ai-field-{name}-{field}")).to_be_visible()

    try:
        # A required field left empty must stop before any request is sent: the platform
        # would otherwise create a half-configured channel.
        writes: list[str] = []
        page.on(
            "request",
            lambda request: writes.append(request.method)
            if request.method in ("POST", "PUT") and "notification" in request.url
            else None,
        )
        # Clear a required text field, submit, and check nothing was written.
        required = next(
            (
                field
                for field in channel["fields"]
                if page.locator(f"#ai-field-{name}-{field}").get_attribute("type") == "text"
            ),
            None,
        )
        if required is not None:
            page.fill(f"#ai-field-{name}-{required}", "")
            page.locator(f'[data-ai-id="notification-{name}:save"]').click()
            page.wait_for_timeout(800)
            alerts = page.locator('[role="alert"]').all_inner_texts()
            assert alerts, f"{name}: 必填为空却没有提示"
            assert writes == [], f"{name}: 校验未拦截就发出了写入请求 {writes}"

        # Fill the channel and save. The notification manager's validating webhook can be
        # unreachable; that is an environment fault, so say so rather than failing the build.
        for field, value in channel["values"].items():
            locator = page.locator(f"#ai-field-{name}-{field}")
            if locator.count() == 0:
                continue
            tag = locator.evaluate("element => element.tagName")
            input_type = locator.get_attribute("type")
            if tag == "SELECT":
                locator.select_option(value=value)
            elif input_type == "checkbox":
                locator.check()
            else:
                locator.fill(value)

        page.locator(f'[data-ai-id="notification-{name}:save"]').click()
        error = page.locator(f'[data-ai-id="notification-{name}:save-error"]')
        try:
            expect(error).to_be_visible(timeout=20_000)
            text = error.inner_text()
            if "webhook" in text or "notification-manager" in text:
                pytest.skip(f"平台通知组件的校验 webhook 不可用，无法验证写入：{text[:120]}")
            pytest.fail(f"{name} 保存失败：{text[:200]}")
        except AssertionError:
            pass

        page.wait_for_function(
            f"""() => !document.querySelector('[data-ai-id="notification-{name}:save"]')?.hasAttribute('data-loading')""",
            timeout=60_000,
        )
        if error.count() and error.is_visible():
            text = error.inner_text()
            if "webhook" in text or "notification-manager" in text:
                pytest.skip(f"平台通知组件的校验 webhook 不可用，无法验证写入：{text[:120]}")
            pytest.fail(f"{name} 保存失败：{text[:200]}")

        # Read back through the API: the receiver must carry the channel's spec key, and
        # the secret must exist under the name this channel uses (Slack's is `-token`).
        status, receiver = api.request("GET", channel["receiver"])
        assert status == 200, f"{name}: receiver 未创建"
        spec = receiver.get("spec") or {}
        assert channel["expect"]["receiver"] in spec, f"{name}: receiver spec 缺渠道键，实际 {list(spec)}"

        status, secret = api.request("GET", channel["secret"])
        assert status == 200, f"{name}: secret 未创建（{channel['secret']}）"
        assert channel["expect"]["secret"] in (secret.get("data") or {}), f"{name}: 凭据未写入"

        if channel["config"]:
            status, config = api.request("GET", channel["config"])
            assert status == 200, f"{name}: config 未创建"

        screenshot(page, f"notification-{name}")
    finally:
        _cleanup(api, channel)
