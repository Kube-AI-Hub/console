"""页面对象：kube-frontend 的应用负载列表与详情。

八种负载共用一套列表与详情（`WorkloadListPage` / `WorkloadDetailPage`），
选择器只在这里出现。与保密字典、服务账户相同，优先用 `data-ai-id`：
它是新前端的对外契约，不随文案变化。

对象的前置数据通过 kube API 创建（Deployment 走 `/apis/apps/v1`，Pod 走
`/api/v1`），因为 kapis 的 resources 端点只注册了 GET。清理逻辑同样放在这里：
写用例的人只需要 `try/finally` 调一次删除，不留 `tc-e2e-` 残留。
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError, expect

#: 一个永远拉不下来的镜像。用它创建部署或容器组，对象会停在未就绪/等待状态，
#: 这既是用例需要的状态，也让清理不必等待镜像下载。
UNPULLABLE_IMAGE = "tc-e2e.invalid/never-pulled:1.0"

#: 一个不存在的节点标签，用来让 Pod 永远调度不出去（phase 停为 Pending）。
UNSCHEDULABLE_NODE_SELECTOR = {"tc-e2e-no-such-node": "true"}

#: `kubectl rollout restart` 写下的注解，也是「重新部署」的验收点。
RESTART_ANNOTATION = "kubectl.kubernetes.io/restartedAt"


class ApiLike(Protocol):
    """`conftest.ApiClient` 的最小接口。

    只声明本页面对象用到的方法，避免 `pages/` 反向 import `conftest`。
    """

    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]: ...


class AppWorkloadsPage:
    """应用负载的列表与详情，以及创建/清理测试对象所需的 API 辅助。"""

    def __init__(
        self,
        page: Page,
        base_url: str,
        cluster: str = "host",
        namespace: str = "default",
        workspace: str = "system-workspace",
        api: ApiLike | None = None,
    ) -> None:
        self.page = page
        self.base = f"{base_url}/kube-frontend/{workspace}/clusters/{cluster}/projects/{namespace}"
        self.cluster = cluster
        self.namespace = namespace
        self.workspace = workspace
        self.api = api

    # ---------------- URLs ----------------

    def url(self, kind: str = "deployments") -> str:
        return f"{self.base}/{kind}"

    def network_create_button(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:create"]')

    def network_create_dialog(self, kind: str) -> Locator:
        """The dedicated create dialog's body: `services-create:dialog` / `ingresses-create:dialog`."""
        return self.page.locator(f'[data-ai-id="{kind}-create:dialog"]')

    def service_create_field(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="services-create:{key}"]')

    def ingress_create_field(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="ingresses-create:{key}"]')

    def ingress_rule_field(self, key: str, index: int = 0) -> Locator:
        """Rule inputs are keyed by a stable row id; find the nth row by attribute prefix."""
        return self.page.locator(f'[data-ai-id^="ingresses-create:{key}:"]').nth(index)

    def ingress_rule_remove(self, index: int = 0) -> Locator:
        return self.page.locator('[data-ai-id^="ingresses-create:rule-remove:"]').nth(index)

    def choose_select(self, ai_id: str, option: str) -> None:
        """Open a Radix select by its handle and pick one option by its visible label."""
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()
        self.page.get_by_role("option", name=option, exact=True).click()

    def network_create_submit(self) -> Locator:
        return self.page.get_by_role("dialog").get_by_role("button", name="确认", exact=True)

    def network_yaml_switch(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:create-yaml"]')

    def network_yaml_submit(self, kind: str) -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:create-yaml-submit"]')

    def network_yaml_editor(self) -> Locator:
        return self.page.get_by_role("dialog").locator(".cm-content")

    def detail_url(self, kind: str, name: str) -> str:
        return f"{self.url(kind)}/{name}"

    # ---------------- List ----------------

    def surface(self, kind: str = "deployments") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}:surface"]').last

    def open(self, kind: str = "deployments") -> None:
        self.page.goto(self.url(kind))
        try:
            expect(self.surface(kind)).to_be_visible(timeout=15_000)
        except AssertionError:
            # A bounce to /login is a session problem, not a page problem; say so
            # with the evidence a report needs instead of a bare "not found".
            state = self.page.evaluate(
                "() => ({ token: Boolean(localStorage.getItem('kubesphere-token')), keys: Object.keys(localStorage) })"
            )
            raise AssertionError(f"{kind} surface missing at {self.page.url}; storage={state}") from None
        self.wait_ready(self.surface(kind))

    def wait_ready(self, surface: Locator | None = None, timeout_ms: int = 60_000) -> None:
        """Wait until the list has settled.

        Generous on purpose: a list that answers in 200ms alone can queue behind
        other requests in a full run, and a 5s budget then reports "still loading"
        for a request that is merely in flight.
        """
        expect(surface or self.surface()).not_to_have_attribute("data-ai-state", "loading", timeout=timeout_ms)

    def state(self, kind: str = "deployments") -> str | None:
        return self.surface(kind).get_attribute("data-ai-state")

    def rows(self, kind: str = "deployments") -> Locator:
        return self.surface(kind).locator("[data-ai-row]")

    def row_names(self, kind: str = "deployments") -> list[str]:
        return [name for name in self.rows(kind).evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if name]

    def headers(self, kind: str = "deployments") -> list[str]:
        """Only the headers actually rendered, which differs by viewport."""
        return [text.strip() for text in self.surface(kind).locator("thead th:visible").all_inner_texts() if text.strip()]

    def row(self, kind: str, name: str) -> Locator:
        return self.surface(kind).locator(f'[data-ai-row="{name}"]')

    def row_text(self, kind: str, name: str) -> str:
        return self.row(kind, name).inner_text()

    def name_link(self, kind: str, name: str) -> Locator:
        """The clickable name cell; the detail is reached by clicking it."""
        return self.surface(kind).locator(f'[data-ai-id="{kind}:open:{name}"]')

    def click_name(self, kind: str, name: str, expect_detail: bool = True) -> None:
        """点击名称进入详情。

        点击后如果详情外壳没有出现，再点一次：列表在后台刷新时行会重新渲染，
        第一次点击可能落在一个已被替换掉的节点上——这在整包运行时最容易复现，
        单跑却看不到。第二次仍失败就让它失败，不掩盖真正的缺陷。
        """
        self.ensure_row(kind, name)
        for attempt in range(2):
            self.page.locator(f'[data-ai-id="{kind}:open:{name}"]').first.click()
            try:
                self.page.wait_for_url(f"**/{kind}/{name}", timeout=10_000)
            except PlaywrightTimeoutError:
                continue
            if not expect_detail:
                return
            try:
                self.detail_surface(kind).wait_for(state="visible", timeout=15_000)
                return
            except PlaywrightTimeoutError:
                continue
        if expect_detail:
            self.detail_surface(kind).wait_for(state="visible", timeout=30_000)

        self.ensure_row(kind, name)
        self.name_link(kind, name).click()

    def search(self, kind: str, keyword: str) -> None:
        box = self.page.locator(f'[data-ai-id="{kind}:search"]').last
        box.fill(keyword)
        # The page debounces for 250ms; waiting for the request is what matters.
        self.page.wait_for_timeout(400)
        self.wait_ready(self.surface(kind))

    def ensure_row(self, kind: str, name: str, timeout_ms: int = 4_000) -> None:
        """Make sure `name` is on screen, searching for it if the first page misses it.

        A freshly created object can sit on page 2, or behind the list request that
        started before it existed. Searching by name is how a person finds it too,
        and it removes the "row not found" flake that only appears in full runs.
        """
        try:
            self.row(kind, name).wait_for(state="visible", timeout=timeout_ms)
            return
        except PlaywrightTimeoutError:
            pass
        self.search(kind, name)
        self.row(kind, name).wait_for(state="visible", timeout=15_000)

    def open_row_menu(self, kind: str, name: str) -> None:
        self.ensure_row(kind, name)
        self.row(kind, name).locator('button[aria-label="更多操作"]').click()

    def click_row_action(self, action: str) -> None:
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    # ---------------- Area tabs / workspace ----------------

    @property
    def tabs_nav(self) -> Locator:
        return self.page.locator('[data-ai-id="area-tabs:app-workloads"]')

    def tab(self, key: str) -> Locator:
        return self.page.locator(f'[data-ai-id="area-tabs:{key}"]')

    def active_tab_key(self) -> str | None:
        """Route segment of the tab marked `aria-current="page"`."""
        active = self.tabs_nav.locator('a[aria-current="page"]')
        expect(active).to_have_count(1)
        ai_id = active.get_attribute("data-ai-id") or ""
        return ai_id.rsplit(":", 1)[-1] or None

    def active_tab_label(self) -> str:
        active = self.tabs_nav.locator('a[aria-current="page"]')
        expect(active).to_have_count(1)
        return active.inner_text().strip()

    def switch_tab(self, key: str) -> None:
        """Click an area tab and wait for the client-side route to land."""
        self.tab(key).click()
        self.page.wait_for_url(f"**/projects/{self.namespace}/{key}")
        expect(self.surface(key)).to_be_visible(timeout=15_000)
        expect(self.tab(key)).to_have_attribute("aria-current", "page")

    @property
    def workspace_bar(self) -> Locator:
        return self.page.locator('[data-ai-id="workspace-bar"]')

    @property
    def current_project(self) -> Locator:
        return self.page.locator('[data-ai-id="workspace:current-project"]')

    # ---------------- Detail ----------------

    def detail_surface(self, kind: str = "deployments") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}-detail:surface"]')

    def open_detail(self, kind: str, name: str) -> None:
        self.page.goto(self.detail_url(kind, name))
        expect(self.detail_surface(kind)).to_be_visible(timeout=15_000)
        self.wait_ready(self.detail_surface(kind))

    def detail_state(self, kind: str = "deployments") -> str | None:
        return self.detail_surface(kind).get_attribute("data-ai-state")

    def attribute_labels(self, kind: str = "deployments") -> list[str]:
        """The `<dt>` labels of the attributes block, in render order."""
        return [text.strip() for text in self.detail_surface(kind).locator("dt").all_inner_texts()]

    def attribute_value(self, kind: str, label: str) -> str:
        """The `<dd>` next to one label; labels themselves carry no handle."""
        term = self.detail_surface(kind).locator("dt", has_text=label).first
        return term.locator("xpath=following-sibling::dd[1]").inner_text().strip()

    def containers(self, kind: str = "deployments") -> Locator:
        return self.page.locator(f'[data-ai-id="{kind}-detail:containers"]')

    def container_images(self, kind: str = "deployments") -> list[str]:
        section = self.containers(kind)
        if section.count() == 0:
            return []
        return [image for image in section.locator("li[data-ai-row]").evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))") if image]

    @property
    def back_link(self) -> Locator:
        return self.page.locator('[data-ai-id="deployments-detail:back"]')

    @property
    def redeploy_button(self) -> Locator:
        return self.page.locator('[data-ai-id="deployments-detail:redeploy"]')

    @property
    def detail_edit_yaml_button(self) -> Locator:
        return self.page.locator('[data-ai-id="deployments-detail:edit-yaml"]')

    # ---------------- Dialogs ----------------

    @property
    def dialog(self) -> Locator:
        return self.page.get_by_role("dialog")

    @property
    def loading_dialog(self) -> Locator:
        return self.page.locator('[data-ai-id="dialog:loading"]')

    def fill(self, ai_id: str, value: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').fill(value)

    def click(self, ai_id: str) -> None:
        self.page.locator(f'[data-ai-id="{ai_id}"]').click()

    def wait_dialog_closed(self, timeout: int = 20_000) -> None:
        expect(self.dialog).to_have_count(0, timeout=timeout)

    def yaml_editor_text(self) -> str:
        """The CodeMirror document currently rendered in the dialog."""
        editor = self.dialog.locator(".cm-content").first
        expect(editor).to_be_visible()
        return editor.inner_text()

    # ---------------- 定制编辑表单 (编辑设置) ----------------

    @property
    def detail_edit_settings_button(self) -> Locator:
        return self.page.locator('[data-ai-id="deployments-detail:edit-settings"]')

    def open_edit_settings(self) -> Locator:
        """Open 编辑设置 on the current deployment detail and return its dialog."""
        self.detail_edit_settings_button.click()
        expect(self.dialog).to_be_visible()
        return self.dialog

    def image_input(self) -> Locator:
        """The image field of a single-container workload; multi-container adds `:name`."""
        return self.page.locator('[data-ai-id="deployments-edit:image"]')

    def set_container_image(self, image: str) -> None:
        self.image_input().fill(image)

    def change_diff_text(self) -> str:
        """The list of fields the dialog says it will change."""
        diff = self.page.locator('[data-ai-id="deployments-edit:diff"]')
        expect(diff).to_be_visible()
        return diff.inner_text()

    def add_env(self, name: str, value: str) -> None:
        """Append one environment variable row and fill it."""
        self.page.locator('[data-ai-id="deployments-edit:env-add"]').click()
        self.page.locator('[data-ai-id^="deployments-edit:env-key"]').last.fill(name)
        self.page.locator('[data-ai-id^="deployments-edit:env-value"]').last.fill(value)

    def remove_env(self, name: str) -> None:
        """Remove the environment variable row whose name input holds the given name."""
        entries = self.page.locator('[data-ai-id^="deployments-edit:env-key"]')
        for index in range(entries.count()):
            entry = entries.nth(index)
            if entry.input_value() != name:
                continue
            ai_id = entry.get_attribute("data-ai-id") or ""
            remove_id = ai_id.replace("env-key", "env-remove")
            self.page.locator(f'[data-ai-id="{remove_id}"]').click()
            return
        raise AssertionError(f"environment variable row {name!r} not found")

    # ---------------- API helpers ----------------

    def wait_deployment_image(self, name: str, image: str, timeout: float = 30) -> None:
        """Wait until the deployment's first container reports the given image."""
        deadline = time.time() + timeout
        seen = None
        while time.time() < deadline:
            status, body = self.get_deployment(name)
            containers = ((((body.get("spec") or {}).get("template") or {}).get("spec") or {}).get("containers") or [])
            seen = containers[0].get("image") if containers else None
            if status == 200 and seen == image:
                return
            time.sleep(0.25)
        raise AssertionError(f"deployment {name} image is {seen!r}, expected {image!r}")

    def wait_deployment_env(self, name: str, env_name: str, expected: str | None, timeout: float = 30) -> None:
        """Wait until the named env var exists with the expected value (or is gone when expected is None)."""
        deadline = time.time() + timeout
        seen: dict[str, str] = {}
        while time.time() < deadline:
            status, body = self.get_deployment(name)
            containers = ((((body.get("spec") or {}).get("template") or {}).get("spec") or {}).get("containers") or [])
            env = (containers[0].get("env") or []) if containers else []
            seen = {str(item.get("name")): str(item.get("value")) for item in env}
            if status == 200:
                if expected is None and env_name not in seen:
                    return
                if expected is not None and seen.get(env_name) == expected:
                    return
            time.sleep(0.25)
        raise AssertionError(f"deployment {name} env {env_name!r} is {seen!r}, expected {expected!r}")

    def unique(self, suffix: str = "") -> str:
        name = f"tc-e2e-{int(time.time() * 1000) % 1_000_000}"
        return f"{name}-{suffix}" if suffix else name

    def _api(self) -> ApiLike:
        if self.api is None:
            raise RuntimeError("AppWorkloadsPage was created without an ApiClient")
        return self.api

    def _request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict[str, Any]]:
        return self._api().request(method, path, body)

    def row_actions(self, kind: str, name: str) -> list[str]:
        """Open the row menu and return its item labels, then dismiss it.

        Reading the actions *without* choosing one is what proves a state-dependent
        action is offered or withheld; clicking through would only test the happy path.
        """
        self.ensure_row(kind, name)
        self.row(kind, name).locator('button[aria-label="更多操作"]').click()
        items = [text.strip() for text in self.page.get_by_role("menuitem").all_inner_texts() if text.strip()]
        self.page.keyboard.press("Escape")
        self.page.wait_for_timeout(200)
        return items

    def run_row_action(self, kind: str, name: str, action: str) -> None:
        """Open the row menu and choose `action`, leaving the dialog to the caller."""
        self.ensure_row(kind, name)
        self.row(kind, name).locator('button[aria-label="更多操作"]').click()
        self.page.get_by_role("menuitem", name=action, exact=True).click()

    def wait_replicas(self, name: str, expected: int, timeout: float = 30) -> None:
        """Wait until the deployment's `spec.replicas` settles on `expected`."""
        deadline = time.time() + timeout
        seen = None
        while time.time() < deadline:
            status, body = self._request("GET", self._kube_path("deployments", name))
            if status == 200:
                seen = ((body.get("spec") or {}).get("replicas"))
                if seen == expected:
                    return
            time.sleep(0.3)
        raise AssertionError(f"deployment {name} replicas is {seen!r}, expected {expected}")

    def create_cronjob(self, name: str) -> int:
        """A CronJob that never actually runs (schedule in the far future)."""
        return self._request(
            "POST",
            self._kube_path("cronjobs"),
            {
                "apiVersion": "batch/v1",
                "kind": "CronJob",
                "metadata": {"name": name, "namespace": self.namespace},
                "spec": {
                    "schedule": "0 0 1 1 *",
                    "jobTemplate": {
                        "spec": {
                            "template": {
                                "spec": {
                                    "restartPolicy": "Never",
                                    "containers": [{"name": "c", "image": UNPULLABLE_IMAGE, "command": ["true"]}],
                                }
                            }
                        }
                    },
                },
            },
        )[0]

    def wait_suspended(self, name: str, timeout: float = 30) -> bool | None:
        """Wait until `spec.suspend` becomes true, returning the value it settled on."""
        deadline = time.time() + timeout
        value: bool | None = None
        while time.time() < deadline:
            status, body = self._request("GET", self._kube_path("cronjobs", name))
            if status == 200:
                value = (body.get("spec") or {}).get("suspend")
                if value is True:
                    return True
            time.sleep(0.3)
        return value

    def delete_cronjob(self, name: str, timeout: float = 60) -> None:
        self._request("DELETE", self._kube_path("cronjobs", name))
        self._wait_gone("cronjobs", name, timeout)

    def _kube_path(self, kind: str, name: str | None = None) -> str:
        """Write path for one kind, honouring the API group.

        `/api/v1` only serves the core group; a Deployment written there is a 404.
        """
        if kind in ("deployments", "statefulsets", "daemonsets"):
            prefix = "/apis/apps/v1"
        elif kind in ("jobs", "cronjobs"):
            prefix = "/apis/batch/v1"
        elif kind == "ingresses":
            prefix = "/apis/networking.k8s.io/v1"
        else:
            prefix = "/api/v1"
        base = f"{prefix}/namespaces/{self.namespace}/{kind}"
        return f"{base}/{name}" if name else base

    def create_deployment(
        self,
        name: str,
        *,
        replicas: int = 1,
        image: str = UNPULLABLE_IMAGE,
        app: str | None = None,
        annotations: dict[str, str] | None = None,
    ) -> str:
        """Create a Deployment with an image that cannot be pulled.

        The un-pullable image is deliberate: it keeps the pods unready, so
        `status.readyReplicas` stays absent/0 and the row shows 更新中 deterministically.
        """
        label = app or name
        body = {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {
                "name": name,
                "namespace": self.namespace,
                "labels": {"app": label},
                "annotations": annotations or {},
            },
            "spec": {
                "replicas": replicas,
                "selector": {"matchLabels": {"app": label}},
                "template": {
                    "metadata": {"labels": {"app": label}},
                    "spec": {"containers": [{"name": "main", "image": image}]},
                },
            },
        }
        status, payload = self._request("POST", self._kube_path("deployments"), body)
        if status not in (200, 201):
            raise AssertionError(f"could not create deployment {name}: {status} {payload}")
        return name

    def get_deployment(self, name: str) -> tuple[int, dict[str, Any]]:
        return self._request("GET", self._kube_path("deployments", name))

    def create_pending_pod(self, name: str, *, image: str = UNPULLABLE_IMAGE) -> str:
        """Create a Pod that can never be scheduled, so `status.phase` stays Pending."""
        body = {
            "apiVersion": "v1",
            "kind": "Pod",
            "metadata": {"name": name, "namespace": self.namespace, "labels": {"app": name}},
            "spec": {
                # No image pull and no node: cleanup is instant.
                "terminationGracePeriodSeconds": 0,
                "containers": [{"name": "main", "image": image}],
                "nodeSelector": UNSCHEDULABLE_NODE_SELECTOR,
            },
        }
        status, payload = self._request("POST", self._kube_path("pods"), body)
        if status not in (200, 201):
            raise AssertionError(f"could not create pod {name}: {status} {payload}")
        return name

    def get_pod(self, name: str) -> tuple[int, dict[str, Any]]:
        return self._request("GET", self._kube_path("pods", name))

    def api_total(self, kind: str = "ingresses") -> int:
        """How many objects of `kind` the page's own read path reports.

        Used to decide whether an empty-state precondition holds before asserting
        it: a project that has grown an ingress is not a product defect.
        """
        status, body = self._request(
            "GET", f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{self.namespace}/{kind}?limit=1"
        )
        if status != 200:
            raise AssertionError(f"could not list {kind}: {status} {body}")
        return int(body.get("totalItems") or len(body.get("items") or []))

    def wait_pod_phase(self, name: str, phase: str = "Pending", timeout: float = 30) -> dict[str, Any]:
        deadline = time.time() + timeout
        last: dict[str, Any] = {}
        while time.time() < deadline:
            status, last = self.get_pod(name)
            if status == 200 and str((last.get("status") or {}).get("phase")) == phase:
                return last
            time.sleep(0.25)
        raise AssertionError(f"pod {name} never reached phase {phase}; last={last}")

    def wait_restart_annotation(self, name: str, timeout: float = 30) -> str:
        """Poll the Deployment until the pod template carries `restartedAt`."""
        deadline = time.time() + timeout
        seen: dict[str, Any] = {}
        while time.time() < deadline:
            status, seen = self.get_deployment(name)
            template = (seen.get("spec") or {}).get("template") or {}
            annotations = (template.get("metadata") or {}).get("annotations") or {}
            stamp = annotations.get(RESTART_ANNOTATION)
            if status == 200 and stamp:
                return str(stamp)
            time.sleep(0.25)
        raise AssertionError(f"deployment {name} never got {RESTART_ANNOTATION}; last={seen}")

    def delete_deployment(self, name: str, timeout: float = 120) -> None:
        """Delete a deployment and wait until it and its pods are gone.

        Safe on already-deleted objects: a 404 is the expected answer when the UI
        performed the delete.
        """
        self._request("DELETE", self._kube_path("deployments", name))
        self._wait_gone("deployments", name, timeout)
        self._wait_pods_gone(name, timeout)

    def delete_pod(self, name: str, timeout: float = 60) -> None:
        self._request("DELETE", self._kube_path("pods", name))
        self._wait_gone("pods", name, timeout)

    def _wait_gone(self, kind: str, name: str, timeout: float) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            status, _ = self._request("GET", self._kube_path(kind, name))
            if status == 404:
                return
            time.sleep(0.25)
        raise AssertionError(f"{kind}/{name} still exists {timeout}s after delete")

    def _wait_pods_gone(self, label: str, timeout: float) -> None:
        """Wait for cascading deletion to finish, so the next run starts clean.

        A pod that already carries a `deletionTimestamp` is *being* removed: kubelet
        has been asked to stop its containers and the apiserver is only holding the
        object until they exit. On a busy shared cluster that can take minutes, and
        failing the case for it would report the cluster's scheduling pressure as a
        test failure. The workload object itself is already gone by then, which is
        what the case is actually about.
        """
        deadline = time.time() + timeout
        pending: list[str] = []
        while time.time() < deadline:
            status, body = self._request("GET", f"/api/v1/namespaces/{self.namespace}/pods?labelSelector=app%3D{label}")
            items = (body.get("items") or []) if status != 404 else []
            pending = [
                (item.get("metadata") or {}).get("name", "")
                for item in items
                if not (item.get("metadata") or {}).get("deletionTimestamp")
            ]
            if not pending:
                return
            time.sleep(0.3)
        raise AssertionError(f"pods with label app={label} still running {timeout}s after delete: {pending}")
