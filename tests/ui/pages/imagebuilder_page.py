"""页面对象：项目级镜像构建器（S2I/B2I）列表与详情。

选择器只在这里出现，规格与用例不写 CSS。优先用 `data-ai-id`：它是新前端的对外契约，
不随文案变化。

测试对象全部用唯一前缀（`tc-e2e-` + 运行后缀）创建并回读，失败也在 `finally` 里清理。
清理必须显式删除 `S2iRun`：控制器不工作时删除构建器不会连带删除运行。
"""

from __future__ import annotations

import base64
import json
import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect

#: CRD 组的原生路径。写入与详情读这里；列表页读的是 kapis 资源代理（服务端分页）。
S2I = "/apis/devops.kubesphere.io/v1alpha1"
#: 列表读的 kapis 路径（服务端分页/搜索/totalItems）。
S2I_LIST_KAPIS = "/kapis/resources.kubesphere.io/v1alpha3"

#: 一个真实可解析的 Git 仓库地址；仅用于表单，构建是否成功由控制器决定。
SAMPLE_SOURCE_URL = "https://github.com/kubesphere/hello-world.git"


class ApiLike(Protocol):
    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        content_type: str = "application/json",
    ) -> tuple[int, dict[str, Any]]: ...


class ImageBuilderPageObject:
    """镜像构建器的列表、创建、详情与 API 辅助。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        *,
        cluster: str = "host",
        namespace: str = "default",
        workspace: str = "system-workspace",
        api: ApiLike | None = None,
    ) -> None:
        self.page = page
        self.base = f"{base_url.rstrip('/')}/kube-frontend/{workspace}/clusters/{cluster}/projects/{namespace}"
        self.cluster = cluster
        self.namespace = namespace
        self.workspace = workspace
        self.api = api

    # ---------------- URLs ----------------

    def list_url(self) -> str:
        return f"{self.base}/s2ibuilder"

    def detail_url(self, name: str) -> str:
        return f"{self.list_url()}/{name}"

    # ---------------- List ----------------

    def open_list(self, *, locale: str | None = None) -> None:
        if locale:
            # The language is stored in localStorage; set it before the app boots.
            self.page.add_init_script(
                "locale => { try { localStorage.setItem('kube-frontend-locale', locale) } catch (e) {} }",
                arg=locale,
            )
        self.page.goto(self.list_url())
        self.surface().wait_for(state="visible", timeout=20_000)
        self.wait_ready()

    def surface(self) -> Locator:
        return self.page.locator('[data-ai-id="image-builder:surface"]').last

    def wait_ready(self, surface: Locator | None = None, timeout_ms: int = 60_000) -> None:
        expect(surface or self.surface()).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self) -> str | None:
        return self.surface().get_attribute("data-ai-state")

    def rows(self) -> Locator:
        return self.surface().locator("[data-ai-row]")

    def row_names(self) -> list[str]:
        return [name for name in self.rows().evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if name]

    def row(self, name: str) -> Locator:
        return self.surface().locator(f'[data-ai-row="{name}"]')

    def headers(self) -> list[str]:
        return [text.strip() for text in self.surface().locator("thead th:visible").all_inner_texts() if text.strip()]

    def name_link(self, name: str) -> Locator:
        return self.surface().locator(f'[data-ai-id="image-builder:open:{name}"]')

    def search(self, keyword: str) -> None:
        box = self.page.locator('[data-ai-id="image-builder:search"]').last
        box.fill(keyword)
        self.page.wait_for_timeout(400)
        self.wait_ready()

    def ensure_row(self, name: str, timeout_ms: int = 5_000) -> None:
        try:
            self.row(name).wait_for(state="visible", timeout=timeout_ms)
            return
        except PlaywrightTimeoutError:
            pass
        self.search(name)
        self.row(name).wait_for(state="visible", timeout=20_000)

    def open_row_menu(self, name: str) -> None:
        self.ensure_row(name)
        self.row(name).locator('button[aria-label="更多操作"]').click()

    def choose_row_action(self, label: str) -> None:
        self.page.get_by_role("menuitem", name=label, exact=True).click()

    # ---------------- Detail ----------------

    def open_detail(self, name: str) -> None:
        self.page.goto(self.detail_url(name))
        self.detail_surface().wait_for(state="visible", timeout=20_000)
        self.wait_ready(self.detail_surface())

    def detail_surface(self) -> Locator:
        return self.page.locator('[data-ai-id="image-builder-detail:surface"]')

    def detail_state(self) -> str | None:
        return self.detail_surface().get_attribute("data-ai-state")

    def attribute_labels(self) -> list[str]:
        return [text.strip() for text in self.detail_surface().locator("dt").all_inner_texts()]

    def attribute_value(self, label: str) -> str:
        term = self.detail_surface().locator("dt", has_text=label).first
        return term.locator("xpath=following-sibling::dd[1]").inner_text().strip()

    def tab(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="image-builder-detail:tab:{key}"]')

    def open_tab(self, key: str) -> None:
        self.tab(key).click()
        expect(self.tab(key)).to_have_attribute("aria-selected", "true")

    def panel(self, value: str) -> Locator:
        return self.page.locator(f'[data-ai-id="image-builder-detail:{value}"]')

    # ---------------- Dialogs ----------------

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    def wait_dialog_closed(self, timeout: int = 30_000) -> None:
        expect(self.dialog).to_have_count(0, timeout=timeout)

    def fill(self, ai_id: str, value: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').fill(value)

    def click(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()

    def choose_select(self, ai_id: str, label: str) -> None:
        """Open a Radix select by its handle and pick the option whose label contains `label`."""
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()
        self.page.get_by_role("option", name=label, exact=False).first.click()

    # ---------------- Create dialog ----------------

    def open_create(self) -> None:
        self.click("image-builder:create")
        expect(self.dialog).to_be_visible(timeout=20_000)

    def create_choose(self, mode: str, language: str) -> None:
        self.click(f"image-builder-create:language:{mode}:{language}")

    def create_next(self) -> None:
        self.click("image-builder-create:next")

    def wait_template_selected(self, timeout: int = 20_000) -> str:
        trigger = self.page.locator('[data-ai-id="image-builder-create:template"]')
        deadline = time.time() + timeout / 1000
        while time.time() < deadline:
            text = (trigger.inner_text() or "").strip()
            if text and "选择构建器镜像" not in text:
                return text
            self.page.wait_for_timeout(200)
        raise AssertionError("builder image template was not preselected")

    def set_advanced_open(self) -> None:
        if self.page.locator('[data-ai-id="image-builder-create:advanced"]').count() == 0:
            self.click("image-builder-create:advanced-toggle")

    def add_environment(self, value: str) -> str:
        """Append one environment row (the name defaults to the first unused template key)."""
        self.set_advanced_open()
        self.click("image-builder-create:env-add")
        entries = self.page.locator('[data-ai-id^="image-builder-create:env-key:"]')
        last_index = entries.count() - 1
        key_trigger = entries.nth(last_index)
        key_text = (key_trigger.inner_text() or "").strip()
        self.page.locator(f'[data-ai-id="image-builder-create:env-value:{last_index}"]').fill(value)
        return key_text

    def upload_artifact(self, file_path: str) -> None:
        self.page.locator('[data-ai-id="image-builder-create:artifact-input"]').set_input_files(file_path)

    def submit_create(self) -> None:
        self.click("image-builder-create:submit")

    def create_validation_text(self) -> str:
        locator = self.page.locator('[data-ai-id="image-builder-create:validation"]')
        return locator.inner_text() if locator.count() else ""

    def create_submit_error(self) -> str:
        locator = self.page.locator('[data-ai-id="image-builder-create:submit-error"]')
        return locator.inner_text() if locator.count() else ""

    def artifact_error(self) -> str:
        locator = self.page.locator('[data-ai-id="image-builder-create:artifact-error"]')
        return locator.inner_text() if locator.count() else ""

    # ---------------- Run dialog ----------------

    def open_run(self) -> None:
        self.click("image-builder-detail:run")
        expect(self.dialog).to_be_visible(timeout=20_000)

    def run_submit(self) -> None:
        self.click("image-builder-run:submit")

    def run_error(self) -> str:
        locator = self.page.locator('[data-ai-id="image-builder-run:error"]')
        return locator.inner_text() if locator.count() else ""

    # ---------------- API helpers ----------------

    def _api(self) -> ApiLike:
        if self.api is None:
            raise RuntimeError("ImageBuilderPageObject was created without an ApiClient")
        return self.api

    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        content_type: str = "application/json",
    ) -> tuple[int, dict[str, Any]]:
        return self._api().request(method, path, body, content_type)

    def _builder_path(self, name: str | None = None) -> str:
        base = f"{S2I}/namespaces/{self.namespace}/s2ibuilders"
        return f"{base}/{name}" if name else base

    def _run_path(self, name: str | None = None) -> str:
        base = f"{S2I}/namespaces/{self.namespace}/s2iruns"
        return f"{base}/{name}" if name else base

    def unique(self, suffix: str = "") -> str:
        base = f"tc-e2e-s2i-{int(time.time() * 1000) % 1_000_000}"
        return f"{base}-{suffix}" if suffix else base

    def list_builders(self) -> tuple[int, list[dict[str, Any]]]:
        status, body = self.request("GET", self._builder_path())
        return status, (body.get("items") or []) if isinstance(body, dict) else []

    def get_builder(self, name: str) -> tuple[int, dict[str, Any]]:
        return self.request("GET", self._builder_path(name))

    def create_builder(
        self,
        name: str,
        *,
        display_name: str | None = None,
        service_name: str | None = None,
        source_url: str = SAMPLE_SOURCE_URL,
        image_name: str = "tc-e2e/image",
        tag: str = "latest",
        environment: dict[str, str] | None = None,
        kind: str = "s2i",
        builder_image: str = "dockerhub.kubekey.local/kube-ai-hub/java-8-centos7:v3.2.0",
        registry_secret: str | None = None,
    ) -> int:
        annotations: dict[str, str] = {"languageType": "java"}
        if display_name:
            annotations["displayName"] = display_name
        if service_name:
            annotations["serviceName"] = service_name
        config: dict[str, Any] = {
            "builderPullPolicy": "if-not-present",
            "builderImage": builder_image,
            "sourceUrl": source_url,
            "revisionId": "master",
            "imageName": image_name,
            "tag": tag,
            "replicas": 0,
            "export": True,
            "outputBuildResult": True,
        }
        if kind == "b2i":
            config["isBinaryURL"] = True
        if environment:
            config["environment"] = [{"name": key, "value": value} for key, value in environment.items()]
        if registry_secret:
            config["pushAuthentication"] = {"secretRef": {"name": registry_secret}}
        body = {
            "apiVersion": "devops.kubesphere.io/v1alpha1",
            "kind": "S2iBuilder",
            "metadata": {
                "name": name,
                "namespace": self.namespace,
                "labels": {"controller-tools.k8s.io": "1.0", "s2i-type.kubesphere.io": kind},
                "annotations": annotations,
            },
            "spec": {"config": config},
        }
        status, payload = self.request("POST", self._builder_path(), body)
        return status

    def delete_builder(self, name: str) -> None:
        """Delete the builder and every run that belongs to it, then wait until it is gone."""
        status, runs = self.request("GET", self._run_path())
        for run in (runs.get("items") or []) if isinstance(runs, dict) else []:
            if (run.get("spec") or {}).get("builderName") != name:
                continue
            run_name = (run.get("metadata") or {}).get("name")
            if run_name:
                self.request("DELETE", self._run_path(run_name))
        self.request("DELETE", self._builder_path(name))
        self.wait_builder_gone(name)

    def wait_builder_gone(self, name: str, timeout: float = 60) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            status, _ = self.request("GET", self._builder_path(name))
            if status == 404:
                return
            time.sleep(0.25)
        raise AssertionError(f"builder {name} still exists")

    def create_run(self, builder_name: str, run_name: str) -> int:
        body = {
            "apiVersion": "devops.kubesphere.io/v1alpha1",
            "kind": "S2iRun",
            "metadata": {"name": run_name, "namespace": self.namespace},
            "spec": {"builderName": builder_name},
        }
        status, _ = self.request("POST", self._run_path(), body)
        return status

    def list_runs(self, builder_name: str | None = None) -> list[dict[str, Any]]:
        status, body = self.request("GET", self._run_path())
        items = (body.get("items") or []) if isinstance(body, dict) else []
        if builder_name is None:
            return items
        return [item for item in items if (item.get("spec") or {}).get("builderName") == builder_name]

    def patch_builder_status(self, name: str, status: dict[str, Any]) -> int:
        """Write the controller's status subresource, so a list/status mapping can be asserted.

        This is a *simulated* controller report: the real s2ioperator on this installation
        cannot watch its own CRDs (see the delivery record), so without it the status,
        run-record and artifact mappings would be unverifiable. The object is test-owned and
        removed by the caller; the report is flagged as simulated in the test docstring.
        """
        code, _ = self.request(
            "PATCH",
            f"{S2I}/namespaces/{self.namespace}/s2ibuilders/{name}/status",
            {"status": status},
            "application/merge-patch+json",
        )
        return code

    def patch_run_status(self, name: str, status: dict[str, Any]) -> int:
        code, _ = self.request(
            "PATCH",
            f"{S2I}/namespaces/{self.namespace}/s2iruns/{name}/status",
            {"status": status},
            "application/merge-patch+json",
        )
        return code

    def create_registry_secret(self, name: str, registry: str = "registry.example.com") -> int:
        auth = base64.b64encode(json.dumps({"auths": {registry: {"username": "x", "password": "y"}}}).encode()).decode()
        body = {
            "apiVersion": "v1",
            "kind": "Secret",
            "metadata": {"name": name, "namespace": self.namespace},
            "type": "kubernetes.io/dockerconfigjson",
            "data": {".dockerconfigjson": auth},
        }
        status, _ = self.request("POST", f"/api/v1/namespaces/{self.namespace}/secrets", body)
        return status

    def delete_secret(self, name: str) -> None:
        self.request("DELETE", f"/api/v1/namespaces/{self.namespace}/secrets/{name}")

    def create_basic_secret(self, name: str) -> int:
        body = {
            "apiVersion": "v1",
            "kind": "Secret",
            "metadata": {"name": name, "namespace": self.namespace},
            "type": "kubernetes.io/basic-auth",
            "stringData": {"username": "tc-e2e", "password": "tc-e2e"},
        }
        status, _ = self.request("POST", f"/api/v1/namespaces/{self.namespace}/secrets", body)
        return status

    def delete_basic_secret(self, name: str) -> None:
        self.request("DELETE", f"/api/v1/namespaces/{self.namespace}/secrets/{name}")
