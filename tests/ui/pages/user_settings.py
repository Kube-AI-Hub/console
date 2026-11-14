"""页面对象：kube-frontend 的用户设置弹窗（基本信息、密码设置）。

入口在右上角账号菜单：`shell:user-menu` → `shell:user-settings`。弹窗根是
`user-settings:surface`，带 `data-ai-state`（loading / ready / error）。选择器只写在
这里，用例按动作命名调用。

几条来自实测、写在这里免得每个用例重新踩的约束：

- **弹窗改的永远是自己。** 它从会话里取账号名，再 `GET users/<name>` 填表，没有「改别人」
  这回事。所以改邮箱/改密码的用例必须先用目标账号登录，不能借管理员的登录态去改 admin。
- **改密后平台不作废旧 token**（实测同一 token 仍能 `GET /api/session/me` 返回 200），
  退出登录是弹窗自己做的：签出后跳 `/login`。所以用例等的是登录页出现，不是某个请求。
- **写邮箱是整对象 `PUT`**：该端点 `PATCH` 回 405。邮箱格式由前端在点保存时挡下、不发请求；
  服务端对非法邮箱回 400 纯文本，对不合规密码回 422 且正文是整条准入正则——都不适合直接展示。
"""

from __future__ import annotations

from typing import Any, Protocol

from playwright.sync_api import Locator, Page, Request, expect

#: 平台账号的 IAM 端点。读（GET）与整对象写（PUT）都在这里，改密挂在 `/password` 上。
IAM = "/kapis/iam.kubesphere.io/v1alpha2"

#: 打开弹窗的落地页。弹窗挂在 shell 上，任何登录后的页面都能打开它；工作台最省事。
DEFAULT_PAGE = "/kube-frontend"

#: 平台角色的注解键，顺序与 `platformRoleOf` 一致（platform-role 优先，其次 globalrole）。
PLATFORM_ROLE_KEYS = ("iam.kubesphere.io/platform-role", "iam.kubesphere.io/globalrole")

#: 算「写请求」的方法。读请求不记：弹窗每次打开都要 GET 一次账号。
WRITE_METHODS = ("POST", "PUT", "PATCH", "DELETE")

#: 强度三档的取值（`data-strength`）与各自的文字标签。三档必须有文字，不能只靠颜色。
STRENGTH_LABELS = {"weak": "弱", "medium": "中", "strong": "强"}

#: 四条 checklist 的键，与 `data-ai-id="user-settings:password-check-<key>"` 对应。
CHECK_KEYS = ("case", "digit", "special", "length")


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


def platform_role_of(user: dict[str, Any]) -> str:
    """账号对象的平台角色，与页面读法一致（platform-role 优先，其次 globalrole）。"""
    annotations = (user.get("metadata") or {}).get("annotations") or {}
    for key in PLATFORM_ROLE_KEYS:
        if annotations.get(key):
            return str(annotations[key])
    return ""


def spec_email_of(user: dict[str, Any]) -> str:
    """`spec.email`；缺省时退回 `email` 注解（`userDetailApi` 的同一套回退）。"""
    spec = user.get("spec") or {}
    if spec.get("email"):
        return str(spec["email"])
    annotations = (user.get("metadata") or {}).get("annotations") or {}
    return str(annotations.get("email") or "")


def annotations_of(user: dict[str, Any]) -> dict[str, str]:
    """账号对象上的注解，用来核对「整对象 PUT 没有顺手抹掉别的字段」。"""
    return {str(key): str(value) for key, value in ((user.get("metadata") or {}).get("annotations") or {}).items()}


class UserSettingsPage:
    """账号菜单里的用户设置弹窗。"""

    def __init__(self, page: Page, base_url: str, api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.api = api
        self._writes: list[str] = []
        self._watching = False

    # ---------------- 入口与弹窗 ----------------

    @property
    def account_menu(self) -> Locator:
        """右上角的账号按钮：弹窗只能从这里进。"""
        return self.page.locator('[data-ai-id="shell:user-menu"]').first

    @property
    def menu_item(self) -> Locator:
        """账号菜单里的「用户设置」。菜单项由 Radix 渲染在 portal 里，所以从 page 上找。"""
        return self.page.locator('[data-ai-id="shell:user-settings"]').first

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:surface"]').last

    def open_from(self, path: str = DEFAULT_PAGE) -> None:
        """先到某个登录后的页面，再从账号菜单打开弹窗。"""
        self.page.goto(f"{self.base_url}{path}")
        expect(self.account_menu).to_be_visible(timeout=60_000)
        self.open()

    def open(self) -> None:
        """从账号菜单打开弹窗，等到 `user-settings:surface` 可见。"""
        self.account_menu.click()
        expect(self.menu_item).to_be_visible()
        self.menu_item.click()
        expect(self.surface).to_be_visible()

    def wait_ready(self, timeout_ms: int = 30_000) -> None:
        """等账号信息读完。密码页签不读数据，状态恒为 ready。"""
        expect(self.surface).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    @property
    def state(self) -> str | None:
        return self.surface.get_attribute("data-ai-state")

    @property
    def is_open(self) -> bool:
        return self.surface.is_visible()

    def close(self) -> None:
        """点弹窗底部的「关闭」，等它从 DOM 上消失。"""
        self.page.locator('[data-ai-id="user-settings:close"]').click()
        expect(self.surface).to_be_hidden()

    # ---------------- 页签 ----------------

    def select_tab(self, tab: str) -> None:
        assert tab in ("profile", "password"), tab
        self.page.locator(f'[data-ai-id="user-settings:tab-{tab}"]').click()

    # ---------------- 基本信息 ----------------

    @property
    def username(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:username"]').last

    @property
    def platform_role(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:platform-role"]').last

    @property
    def email_input(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:email"]').last

    def email_value(self) -> str:
        return self.email_input.input_value()

    def fill_email(self, value: str) -> None:
        self.email_input.fill(value)

    def save_profile(self) -> None:
        self.page.locator('[data-ai-id="user-settings:profile-save"]').click()

    @property
    def profile_error(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:profile-error"]').last

    @property
    def profile_saved(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:profile-saved"]').last

    # ---------------- 密码设置 ----------------

    @property
    def current_password(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:current-password"]').last

    @property
    def new_password(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:new-password"]').last

    @property
    def confirm_password(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:confirm-password"]').last

    def fill_password(self, current: str, new: str, confirm: str) -> None:
        self.current_password.fill(current)
        self.new_password.fill(new)
        self.confirm_password.fill(confirm)

    @property
    def confirm_hint(self) -> Locator:
        """确认密码框下方的实时比对提示。确认密码为空时这个节点不存在。"""
        return self.page.locator('[data-ai-id="user-settings:confirm-hint"]').last

    def confirm_match(self) -> str | None:
        """比对结果的 `data-match`：true / false。"""
        return self.confirm_hint.get_attribute("data-match")

    def save_password(self) -> None:
        self.page.locator('[data-ai-id="user-settings:password-save"]').click()

    @property
    def password_error(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:password-error"]').last

    @property
    def password_saved(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:password-saved"]').last

    @property
    def password_rule(self) -> Locator:
        """新密码框上方的常驻规则说明（老 console 的 PASSWORD_DESC 迁移）。"""
        return self.page.locator('[data-ai-id="user-settings:password-rule"]').last

    # ---------------- 密码强度面板 ----------------

    @property
    def strength_panel(self) -> Locator:
        """新密码框下方的强度面板。新密码为空时它不渲染，所以这里不能用 .first/.last 兜底。"""
        return self.page.locator('[data-ai-id="user-settings:password-strength"]').last

    @property
    def strength_bar(self) -> Locator:
        return self.page.locator('[data-ai-id="user-settings:password-strength-bar"]').last

    def strength(self) -> str | None:
        """`data-strength`：weak / medium / strong。"""
        return self.strength_panel.get_attribute("data-strength")

    def strength_text(self) -> str:
        """面板上的文字。用来证明三档各有文字标签（弱/中/强），而不是只有颜色。"""
        return self.strength_panel.inner_text()

    def strength_label(self) -> str | None:
        """面板里出现的那个强度标签字（弱/中/强）。"""
        text = self.strength_text()
        for label in STRENGTH_LABELS.values():
            if label in text:
                return label
        return None

    def strength_bar_percent(self) -> float:
        """进度条宽度百分比。

        先读内联 `style.width`（33% / 66% / 100% 最自然的写法），没有就按像素量它占父元素
        （轨道）的比例。两种实现都算「进度条宽度」，断言不去依赖类名或某一种写法。
        """
        return float(
            self.strength_bar.evaluate(
                """el => {
                    const inline = (el.style && el.style.width) || '';
                    if (inline.trim().endsWith('%')) return parseFloat(inline);
                    const track = el.parentElement;
                    const total = track ? track.getBoundingClientRect().width : 0;
                    return total > 0 ? (el.getBoundingClientRect().width / total) * 100 : 0;
                }"""
            )
        )

    def wait_strength_bar(self, percent: float, tolerance: float = 2.0, timeout_ms: int = 5_000) -> float:
        """等进度条稳定到某个宽度。

        宽度带 CSS 过渡（`transition-all`）：填完立刻量会读到**上一档**的宽度——弱→中→强连测
        时三档都会读到 33%。先给过渡一个落定窗口，再轮询到目标值，比加大容差诚实。
        """
        import time

        self.page.wait_for_timeout(400)
        deadline = time.monotonic() + timeout_ms / 1000
        measured = self.strength_bar_percent()
        while abs(measured - percent) > tolerance:
            if time.monotonic() > deadline:
                raise AssertionError(f"进度条宽度停在 {measured:.1f}%，期望 {percent:.0f}%")
            self.page.wait_for_timeout(100)
            measured = self.strength_bar_percent()
        return measured

    def checklist(self) -> dict[str, bool]:
        """四条 checklist 的 `data-met`：case / digit / special / length。"""
        out: dict[str, bool] = {}
        for key in CHECK_KEYS:
            locator = self.page.locator(f'[data-ai-id="user-settings:password-check-{key}"]').last
            out[key] = (locator.get_attribute("data-met") or "").lower() == "true"
        return out

    # ---------------- 可编辑性 ----------------

    def is_editable(self, field: str) -> bool:
        """该字段是不是可编辑控件（用户名、平台角色应为 False，邮箱为 True）。

        「只读」不靠类名或 `disabled` 猜：直接问元素本身能不能输入。
        """
        locator = self.page.locator(f'[data-ai-id="user-settings:{field}"]').last
        return bool(locator.evaluate("el => el.matches('input, textarea, select') || el.isContentEditable"))

    # ---------------- 写请求记录 ----------------

    def watch_writes(self) -> None:
        """开始记录页面发出的写请求。

        「校验没通过就不发请求」只能这样证明：接口回读看不出「有没有发过」，而断言
        「弹窗还开着」只说明界面没跳走。
        """
        if self._watching:
            return
        self.page.on("request", self._record)
        self._watching = True

    def _record(self, request: Request) -> None:
        if request.method.upper() in WRITE_METHODS:
            self._writes.append(f"{request.method.upper()} {request.url}")

    def reset_writes(self) -> None:
        self.watch_writes()
        self._writes.clear()

    @property
    def writes(self) -> list[str]:
        return list(self._writes)

    def user_writes(self, name: str) -> list[str]:
        """发到该账号对象（含 `/password`）的写请求，形如 `PUT http://…/users/<name>`。"""
        marker = f"{IAM}/users/{name}"
        return [entry for entry in self._writes if marker in entry]

    # ---------------- 接口回读 ----------------

    def get_user(self, name: str) -> dict[str, Any]:
        """账号对象原文。页面读的就是它，回读值才有意义。"""
        assert self.api is not None, "api client required"
        status, body = self.api.request("GET", f"{IAM}/users/{name}")
        if status != 200:
            raise AssertionError(f"GET {IAM}/users/{name} answered {status}: {body}")
        return body
