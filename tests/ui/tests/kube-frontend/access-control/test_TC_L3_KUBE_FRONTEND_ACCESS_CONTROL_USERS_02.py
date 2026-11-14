from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"

#: 创建弹窗里的密码强度面板。与个人设置共用同一个组件，但句柄前缀是 `users`：
#: 两处 scope 不同，一个弹窗里不该出现另一个的句柄。
STRENGTH = '[data-ai-id="users:password-strength"]'


def _exists(ui, username: str) -> bool:
    """Whether the user exists, answered from the list.

    `GET /users/<missing>` comes back 500 from this deployment, not 404, so a status
    check would be reading the BFF's error mapping rather than whether the user is there.
    """
    status, body = ui.api.request("GET", f"{USERS}?limit=-1")
    assert status == 200, status
    return any((item.get("metadata") or {}).get("name") == username for item in body.get("items") or [])


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USERS_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02 用户：创建、密码校验与密码强度面板。"""

    ui = access_control_page
    assert ui.api is not None
    name = f"tc-e2e-u{uuid4().int % 1_000_000}"
    try:
        ui.open("users")
        ui.wait_ready("users")
        ui.page.locator('[data-ai-id="users:create"]').click()
        dialog = ui.page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        # The form mounts after the dialog frame. Filling before the inputs exist leaves
        # the fields empty, and the next click then lands while the modal is still
        # animating — the full run saw the dialog vanish here once, while the same case
        # passed alone.
        expect(ui.page.locator("#ai-field-name")).to_be_visible(timeout=20_000);

        # 密码强度面板：边输入边报强度，密码为空时面板不存在。
        # 这里只观察、不提交，下面那串创建/拒绝流程保持原样。
        password = ui.page.locator("#ai-field-password")
        strength = ui.page.locator(STRENGTH)
        # 输入框 id 没变（面板接的是同一个字段的自定义渲染器，不是换了个控件）。
        expect(password).to_be_visible()
        assert strength.count() == 0, "密码为空时不应渲染强度面板"

        password.fill("abc")
        expect(strength).to_have_attribute("data-strength", "weak")
        password.fill("Abcdefg1@")
        expect(strength).to_have_attribute("data-strength", "medium")
        password.fill("Abcdefgh1234@")
        expect(strength).to_have_attribute("data-strength", "strong")
        # 面板属于这个弹窗：个人设置的 user-settings:* 句柄一个都不该出现。
        assert dialog.locator('[data-ai-id^="user-settings:"]').count() == 0, "创建用户弹窗里混进了个人设置的句柄"

        # An illegal user name is refused before a request is made.
        #
        # The check that was here asserted the dialog contains "8 位" — but that text is
        # the field's static hint and is always present, so it passed whether or not the
        # password was rejected. "The dialog is still open" plus "no user exists" is what
        # actually distinguishes a refused submit from a successful one.
        ui.page.locator("#ai-field-name").fill("Bad Name")
        # IAM enforces a unique email, not just a unique name: reusing one address made
        # the second run fail with 409, which read as "the dialog will not close".
        ui.page.locator("#ai-field-email").fill(f"{name}@example.com")
        # The console requires a special character in a password (PASSWORD_DESC is the rule, not
        # just a hint), so a valid password here has one.
        ui.page.locator("#ai-field-password").fill("Strong@12345")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_be_visible()
        expect(dialog).to_have_count(1, timeout=15_000)
        assert _exists(ui, "Bad Name") is False, "非法用户名竟然被创建"

        # So is a password the platform would reject.
        ui.page.locator("#ai-field-name").fill(name)
        ui.page.locator("#ai-field-password").fill("short")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(1, timeout=15_000)
        assert _exists(ui, name) is False, "短密码竟然创建了用户"

        # The console is stricter than the apiserver here: every character class except a special
        # character is refused by the form even though the CRD alone would accept it.
        ui.page.locator("#ai-field-password").fill("Strong12345")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(1, timeout=15_000)
        assert _exists(ui, name) is False, "缺特殊字符的密码竟然创建了用户"

        ui.page.locator("#ai-field-password").fill("Strong@12345")
        dialog.get_by_role("button", name="确认").click()
        expect(dialog).to_have_count(0, timeout=30_000)

        status, body = ui.api.request("GET", f"{USERS}/{name}")
        assert status == 200, (status, body)
        # The role is an annotation: a user without it can sign in but do nothing.
        annotations = ((body.get("metadata") or {}).get("annotations") or {})
        assert annotations.get("iam.kubesphere.io/platform-role") == "platform-regular", annotations
        assert annotations.get("iam.kubesphere.io/uninitialized") == "true", annotations
        screenshot(ui.page, "access-users-create")
    finally:
        ui.api.request("DELETE", f"{USERS}/{name}")