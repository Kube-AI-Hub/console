"""页面对象：kube-frontend 的服务账户列表与详情。

与保密字典同一套选择器约定；额外覆盖 kubeconfig 块与角色弹窗。
"""

from __future__ import annotations

from playwright.sync_api import Locator, Page, expect


class ServiceAccountsPage:
    """服务账户列表与详情。"""

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
        self.list_url = f"{self.base}/serviceaccounts"
        self.namespace = namespace

    def detail_url(self, name: str) -> str:
        return f"{self.list_url}/{name}"

    @property
    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="serviceaccounts:surface"]').last

    def open(self) -> None:
        self.page.goto(self.list_url)
        expect(self.surface).to_be_visible()
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
        return [text.strip() for text in self.surface.locator("thead th:visible").all_inner_texts() if text.strip()]

    def row(self, name: str) -> Locator:
        return self.surface.locator(f'[data-ai-row="{name}"]')

    def row_text(self, name: str) -> str:
        return self.row(name).inner_text()

    @property
    def search_box(self) -> Locator:
        return self.surface.locator('[data-ai-id="serviceaccounts:search"]')

    def search(self, keyword: str) -> None:
        self.search_box.fill(keyword)
        self.page.wait_for_timeout(400)
        self.wait_ready()

    def open_row_menu(self, name: str) -> None:
        self.row(name).locator('button[aria-label="更多操作"]').click()

    def click_row_action(self, action: str) -> None:
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    # ---------------- Detail ----------------

    @property
    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="serviceaccount-detail:surface"]')

    def attribute(self, key: str) -> str:
        return self.page.locator(f'[data-ai-id="serviceaccount-detail:attr-{key}"]').inner_text()

    @property
    def data_section(self) -> Locator:
        return self.page.locator('[data-ai-id="serviceaccount-detail:secrets"]')

    def kubeconfig(self, secret: str) -> str:
        """The rendered kubeconfig, once the token Secret has actually loaded.

        The section paints before its Secret query resolves (masking an empty
        document); reading immediately returns `token: ""`.
        """
        element = self.page.locator(f'[data-ai-id="serviceaccount-detail:kubeconfig:{secret}"]')
        element.wait_for(state="visible")
        expect(self.page.locator(f'[data-ai-id="serviceaccount-detail:toggle:{secret}"]')).to_be_visible()
        self.page.wait_for_function(
            """(selector) => {
                const el = document.querySelector(selector);
                return Boolean(el && el.textContent && el.textContent.includes('ca.crt') === false && el.textContent.includes('token:'));
            }""",
            arg=f'[data-ai-id="serviceaccount-detail:kubeconfig:{secret}"]',
        )
        return element.inner_text()

    def reveal_token_block(self, secret: str) -> None:
        toggle = self.page.locator(f'[data-ai-id="serviceaccount-detail:toggle:{secret}"]')
        if toggle.get_attribute("aria-pressed") != "true":
            toggle.click()

    @property
    def toggle_values(self) -> Locator:
        """First token block's mask toggle."""
        return self.page.locator('[data-ai-id^="serviceaccount-detail:toggle:"]').first

    @property
    def values_revealed(self) -> bool:
        return self.toggle_values.get_attribute("aria-pressed") == "true"

    def reveal(self) -> None:
        if not self.values_revealed:
            self.toggle_values.click()

    # ---------------- Dialogs ----------------

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    def fill(self, ai_id: str, value: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').fill(value)

    def click(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()

    def choose_role(self, role: str, submit_ai_id: str = "serviceaccounts:field-role") -> None:
        """Pick a project role; the searchable Select is wrapped by a surface."""
        self.page.locator(f'[data-ai-id="{submit_ai_id}"] [role="combobox"]').click()
        self.page.get_by_role("option", name=role, exact=True).click()
