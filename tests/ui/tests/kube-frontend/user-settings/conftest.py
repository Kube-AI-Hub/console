"""用户设置用例的夹具：临时账号 + 独立登录的页面对象。

为什么必须是临时账号：弹窗改的是**当前登录账号自己**（它从会话取账号名再读 `users/<name>`），
而改密码会让会话失效。拿 admin 或 ui-test 去跑，一条失败的用例就会把整个套件的登录态带走，
而且会真的改掉共享账号的密码。所以每条要写账号的用例自己建一个 `tc-e2e-uset-<uuid>`
（platform-regular），跑完在 finally 里删掉——断言失败也删。

夹具拿到的 `api` 是 `e2e_objects` 里那个带管理员令牌的 `ApiClient`：建账号、读回账号、删账号
都要平台管理员权限；被测页面则不需要，platform-regular 改自己的邮箱与密码就够。
"""

from __future__ import annotations

import time
from typing import Any, Callable

from uuid import uuid4

import pytest
from playwright.sync_api import BrowserContext, expect

from pages.login import LoginPage
from pages.user_settings import IAM, UserSettingsPage


def _wait_until_signin(api: Any, name: str, password: str, timeout_s: float = 30.0) -> None:
    """等账号真的能登录。

    账号建好到身份数据可用之间有一个短窗口（实测建完立刻登录偶尔被拒）。先用接口登录一次
    探明，免得把这段等待算到页面的账上——那种失败看起来像「登录页坏了」。
    """
    deadline = time.time() + timeout_s
    last = ""
    while time.time() < deadline:
        status, body = api.request("POST", "/api/session/login", {"username": name, "password": password})
        if status == 200 and (body or {}).get("token"):
            return
        last = f"{status} {body}"
        time.sleep(1.0)
    raise AssertionError(f"临时账号 {name} 在 {timeout_s:.0f} 秒内无法登录：{last}")


@pytest.fixture
def user_settings_page(page, ui_config, e2e_objects) -> UserSettingsPage:
    """共享登录态（KA_USERNAME）上的用户设置弹窗。只读用例用它。"""
    return UserSettingsPage(page, ui_config.app.rstrip("/"), api=e2e_objects["api"])


@pytest.fixture
def temp_user(e2e_objects) -> Callable[..., dict[str, Any]]:
    """建一个 platform-regular 临时账号，用例结束后删掉。

    名字带 `tc-e2e-` 前缀，崩掉的运行留下的是明显的垃圾而不是像真数据的东西；uuid 后缀让
    并发 worker 之间不会互相删除。
    """
    api = e2e_objects["api"]
    created: list[str] = []

    def create(*, email: str | None = None, description: str | None = None) -> dict[str, Any]:
        name = f"tc-e2e-uset-{uuid4().hex[:8]}"
        # 平台规则：8–64 位，且同时含小写字母、大写字母、数字。
        password = f"TcE2e{uuid4().hex[:6].upper()}9"
        annotations: dict[str, str] = {"iam.kubesphere.io/platform-role": "platform-regular"}
        if description is not None:
            annotations["kubesphere.io/description"] = description
        address = email if email is not None else f"{name}@example.com"
        body = {
            "apiVersion": "iam.kubesphere.io/v1alpha2",
            "kind": "User",
            "metadata": {"name": name, "annotations": annotations},
            "spec": {"email": address, "password": password},
        }
        status, answer = api.request("POST", f"{IAM}/users", body)
        if status not in (200, 201):
            raise AssertionError(f"建不出临时账号 {name}：{status} {answer}")
        created.append(name)
        _wait_until_signin(api, name, password)
        return {"name": name, "password": password, "email": address}

    try:
        yield create
    finally:
        # 无条件删：断言失败不能把账号留在集群里，下次运行会以另一种方式失败。
        for name in created:
            api.request("DELETE", f"{IAM}/users/{name}")


@pytest.fixture
def settings_page_for(browser, ui_config, e2e_objects) -> Callable[[str, str], UserSettingsPage]:
    """以指定账号真登录一个独立 context，返回该 context 上的用户设置页面对象。

    为什么必须真登录：改密会签出，改邮箱改的是当前登录账号。共享登录态既改不了别人，
    也会被改密带走。用 `context.add_init_script` 注 token 更不行——它在每次文档加载时重跑，
    跳到 /login 后会把 token 写回去，测出来的「已退出」是假的。
    """
    base = ui_config.app.rstrip("/")
    api = e2e_objects["api"]
    contexts: list[BrowserContext] = []

    def open_as(username: str, password: str) -> UserSettingsPage:
        context = browser.new_context(
            viewport={"width": 1600, "height": 900},
            locale="zh-CN",
            ignore_https_errors=True,
        )
        contexts.append(context)
        page = context.new_page()
        login = LoginPage(page, base)
        login.open()
        login.sign_in(username, password)
        ui = UserSettingsPage(page, base, api=api)
        # 登录成功后 app 会整页跳到工作台。等 shell 的账号菜单出来再继续，否则紧接着的
        # goto 会和这次跳转抢方向。
        expect(ui.account_menu).to_be_visible(timeout=60_000)
        return ui

    try:
        yield open_as
    finally:
        for context in contexts:
            context.close()
