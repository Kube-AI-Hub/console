"""页面对象：kube-frontend 的保密字典列表与详情。

选择器只出现在这里。用例按动作命名调用，不直接写 CSS。

选择器优先用 `data-ai-id`：它是新前端的对外契约（见 design/kube-frontend），
不随文案变化。ai-kit 的可搜索 `Select` 不透传属性，其句柄挂在包裹的
`AiSurface` 上（如 `secrets:field-type`），因此定位时先找句柄再找 `[role=combobox]`。
"""

from __future__ import annotations

from playwright.sync_api import Locator, Page, expect


class SecretsPage:
    """保密字典列表与详情。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        namespace: str = "default",
        workspace: str = "system-workspace",
    ) -> None:
        self.page = page
        self.base = f"{base_url}/kube-frontend/{workspace}/clusters/{cluster}/projects/{namespace}"
        self.list_url = f"{self.base}/secrets"

    def detail_url(self, name: str) -> str:
        return f"{self.list_url}/{name}"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="secrets:surface"]').last

    def open(self) -> None:
        self.page.goto(self.list_url)
        try:
            expect(self.surface).to_be_visible(timeout=15_000)
        except AssertionError:
            # A bounce to /login is a session problem, not a page problem; say so
            # with the evidence the report needs instead of a bare "not found".
            state = self.page.evaluate(
                "() => ({ token: Boolean(localStorage.getItem('kubesphere-token')), keys: Object.keys(localStorage) })"
            )
            raise AssertionError(f"secrets surface missing at {self.page.url}; storage={state}") from None
        self.wait_ready()

    def open_detail(self, name: str) -> None:
        self.page.goto(self.detail_url(name))
        expect(self.detail_surface).to_be_visible()
        self.wait_ready(self.detail_surface)

    def wait_ready(self, surface: Locator | None = None) -> None:
        expect(surface or self.surface).not_to_have_attribute("data-ai-state", "loading")

    @property
    def state(self) -> str | None:
        return self.surface.get_attribute("data-ai-state")

    @property
    def rows(self) -> Locator:
        return self.surface.locator("[data-ai-row]")

    def row_names(self) -> list[str]:
        return [name for name in self.rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if name]

    @property
    def headers(self) -> list[str]:
        """Only the headers actually rendered, which differs by viewport."""
        return [text.strip() for text in self.surface.locator("thead th:visible").all_inner_texts() if text.strip()]

    def row(self, name: str) -> Locator:
        return self.surface.locator(f'[data-ai-row="{name}"]')

    def row_text(self, name: str) -> str:
        return self.row(name).inner_text()

    @property
    def search_box(self) -> Locator:
        return self.surface.locator('[data-ai-id="secrets:search"]')

    def search(self, keyword: str) -> None:
        self.search_box.fill(keyword)
        # The page debounces for 250ms; waiting for the request is what matters.
        self.page.wait_for_timeout(400)
        self.wait_ready()

    @property
    def create_button(self) -> Locator:
        return self.page.locator('[data-ai-id="secrets:create"]').last

    def open_row_menu(self, name: str) -> None:
        self.row(name).locator('button[aria-label="更多操作"]').click()

    def click_row_action(self, action: str) -> None:
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    def select_row(self, name: str) -> None:
        self.surface.locator(f'input[data-ai-id="secrets:select:{name}"]').check()

    # ---------------- Detail ----------------

    @property
    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="secret-detail:surface"]')

    @property
    def detail_state(self) -> str | None:
        return self.detail_surface.get_attribute("data-ai-state")

    def attribute(self, key: str) -> str:
        """One of cluster/project/type/created/creator, by suffix of the handle."""
        return self.page.locator(f'[data-ai-id="secret-detail:attr-{key}"]').inner_text()

    @property
    def data_section(self) -> Locator:
        return self.page.locator('[data-ai-id="secret-detail:data"]')

    @property
    def toggle_values(self) -> Locator:
        return self.page.locator('[data-ai-id="secret-detail:toggle-values"]')

    def reveal(self) -> None:
        if self.toggle_values.get_attribute("aria-pressed") != "true":
            self.toggle_values.click()

    def hide(self) -> None:
        if self.toggle_values.get_attribute("aria-pressed") == "true":
            self.toggle_values.click()

    @property
    def values_revealed(self) -> bool:
        return self.toggle_values.get_attribute("aria-pressed") == "true"

    @property
    def set_default_button(self) -> Locator:
        return self.page.locator('[data-ai-id="secret-detail:set-default"]')

    # ---------------- Dialogs ----------------

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    def fill(self, ai_id: str, value: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').fill(value)

    def click(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()

    def choose_type(self, label: str) -> None:
        """Pick a type in the settings editor (its Select is wrapped by a surface)."""
        self.page.locator('[data-ai-id="secrets:field-type"] [role="combobox"]').click()
        self.page.get_by_role("option", name=label, exact=True).click()


class AppShellNav:
    """侧栏导航：三项资源入口。"""

    def __init__(self, page: Page) -> None:
        self.page = page

    def entries(self) -> list[str]:
        return [text.strip() for text in self.page.locator("aside a").all_inner_texts() if text.strip()]

    def open(self, label: str) -> None:
        self.page.locator("aside a", has_text=label).first.click()
