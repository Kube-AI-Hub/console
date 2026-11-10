"""页面对象：kube-frontend 的登录页与账号菜单。

与 `configmaps.py` 同一套约定：选择器只出现在这里，用例按动作命名调用。
登录页的输入框用 id，因为原生 `<input>` 的 `data-ai-id` 会与表单语义重复；
提交与重试按钮走 `data-ai-id`。
"""

from __future__ import annotations

from playwright.sync_api import Locator, Page, expect


class LoginPage:
    """`/login` 表单。"""

    def __init__(self, page: Page, base_url: str) -> None:
        self.page = page
        self.url = f"{base_url}/login"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="login:surface"]')

    @property
    def username(self) -> Locator:
        return self.page.locator("#login-username")

    @property
    def password(self) -> Locator:
        return self.page.locator("#login-password")

    @property
    def submit(self) -> Locator:
        return self.page.locator('[data-ai-id="login:submit"]')

    @property
    def error_panel(self) -> Locator:
        return self.page.locator('[data-ai-id="login:error"]')

    @property
    def field_errors(self) -> list[str]:
        """输入框下方的校验提示。"""
        return [text.strip() for text in self.page.locator("main p[role='alert']").all_inner_texts() if text.strip()]

    @property
    def state(self) -> str | None:
        return self.surface.get_attribute("data-ai-state")

    def open(self) -> None:
        self.page.goto(self.url)
        expect(self.surface).to_be_visible()

    def sign_in(self, username: str, password: str) -> None:
        self.username.fill(username)
        self.password.fill(password)
        self.submit.click()

    def sign_out(self) -> None:
        """通过右上角账号菜单退出。

        菜单项由 Radix 渲染在 portal 里，因此从 `page` 而不是 shell 里找。
        """
        self.page.locator('[data-ai-id="shell:user-menu"]').click()
        self.page.get_by_role("menuitem", name="退出登录", exact=True).click()
        # Assert on the rendered form rather than on a navigation event: signing
        # out is a full document load, and an `expect_navigation` around the click
        # can miss it when the menu item closes the menu first.
        expect(self.surface).to_be_visible(timeout=15_000)
