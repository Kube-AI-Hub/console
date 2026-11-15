"""页面对象：kube-frontend 集群 DevOps 工程页族。

覆盖列表、工程详情七个页签、流水线详情与运行记录，以及工程/流水线/凭证/成员/代码仓库/白名单的读写辅助。
选择器一律用 data-ai-id；接口辅助只用于准备与清理本用例自建对象，不用于替代页面断言。

作用域：集群作用域，URL 为 /kube-frontend/clusters/<cluster>/devops[/<name>[/pipelines/<pipeline>]]。
"""

from __future__ import annotations

import re
from typing import Any, Protocol
from uuid import uuid4

from playwright.sync_api import Locator, Page, expect

PROJECTS = "/apis/devops.kubesphere.io/v1alpha3/devopsprojects"
DEVOPS = "/apis/devops.kubesphere.io/v1alpha3"
DEVOPS_KAPIS = "/kapis/devops.kubesphere.io/v1alpha3"
IAM_KAPIS = "/kapis/iam.kubesphere.io/v1alpha2"

CREDENTIAL_SECRET_TYPES = {
    "username_password": "credential.devops.kubesphere.io/basic-auth",
    "ssh": "credential.devops.kubesphere.io/ssh-auth",
    "secret_text": "credential.devops.kubesphere.io/secret-text",
    "kubeconfig": "credential.devops.kubesphere.io/kubeconfig",
}


class ApiLike(Protocol):
    def request(self, method: str, path: str, body: dict | None = None, content_type: str = "application/json", timeout: float = 30) -> tuple[int, dict[str, Any]]: ...


class DevopsPage:
    """DevOps 工程列表 / 详情 / 流水线详情与写操作。"""

    def __init__(self, page: Page, base_url: str, cluster: str = "host", api: ApiLike | None = None) -> None:
        self.page = page
        self.base_url = base_url.rstrip("/")
        self.cluster = cluster
        self.api = api

    # ---------------------------------------------------------------- urls --
    def url(self, project: str | None = None, pipeline: str | None = None) -> str:
        base = f"{self.base_url}/kube-frontend/clusters/{self.cluster}/devops"
        if project is None:
            return base
        if pipeline is None:
            return f"{base}/{project}"
        return f"{base}/{project}/pipelines/{pipeline}"

    def open_list(self, timeout: int = 30_000) -> None:
        self.page.goto(self.url(), wait_until="domcontentloaded")
        expect(self.surface("devops:surface")).to_be_visible(timeout=timeout)
        expect(self.surface("devops:surface")).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    def open_project(self, name: str, timeout: int = 30_000) -> None:
        self.page.goto(self.url(name), wait_until="domcontentloaded")
        expect(self.surface("devops-detail:surface")).to_be_visible(timeout=timeout)
        expect(self.surface("devops-detail:surface")).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    def open_pipeline(self, project: str, pipeline: str, run: str | None = None) -> None:
        url = self.url(project, pipeline)
        if run:
            url = f"{url}?run={run}"
        self.page.goto(url, wait_until="domcontentloaded")
        expect(self.surface("pipeline-detail:surface")).to_be_visible(timeout=30_000)
        expect(self.surface("pipeline-detail:surface")).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    # ------------------------------------------------------------ locators --
    def surface(self, ai_id: str) -> Locator:
        return self.page.locator(f'[data-ai-id="{ai_id}"]').last

    def locator(self, ai_id: str) -> Locator:
        return self.page.locator(f'[data-ai-id="{ai_id}"]').last

    def click(self, ai_id: str) -> None:
        self.locator(ai_id).click()

    def fill(self, ai_id: str, value: str) -> None:
        self.locator(ai_id).fill(value)

    def text(self, ai_id: str) -> str:
        return self.locator(ai_id).inner_text()

    def visible(self, ai_id: str) -> bool:
        return self.page.locator(f'[data-ai-id="{ai_id}"]').count() > 0

    def tab(self, tab: str) -> Locator:
        return self.locator(f"devops-detail:tab:{tab}")

    def open_tab(self, tab: str) -> None:
        trigger = self.tab(tab)
        expect(trigger).to_be_visible(timeout=30_000)
        trigger.click()
        expect(trigger).to_have_attribute("aria-selected", "true", timeout=20_000)

    def tab_text(self, tab: str) -> str:
        return self.tab(tab).inner_text()

    def panel_states(self, tab: str) -> list[str]:
        """本页签当前渲染了哪几态（table / empty / error 的子集）。"""
        found: list[str] = []
        for state in ("table", "empty", "error"):
            if self.page.locator(f'[data-ai-id="devops-detail:{tab}-{state}"]').count() > 0:
                found.append(state)
        return found

    def collection_rows(self, tab: str) -> Locator:
        return self.page.locator(f'[data-ai-id="devops-detail:{tab}-table"] tbody tr[data-ai-row]')

    def expect_exactly_one_state(self, tab: str, timeout: int = 60_000) -> str:
        collected = self.page.locator(
            f'[data-ai-id="devops-detail:{tab}-table"], [data-ai-id="devops-detail:{tab}-empty"], '
            f'[data-ai-id="devops-detail:{tab}-error"]'
        )
        expect(collected.first).to_be_visible(timeout=timeout)
        states = self.panel_states(tab)
        assert len(states) == 1, f"{tab} 应恰好显示 table/empty/error 之一，实际 {states}"
        return states[0]

    def dialog(self) -> Locator:
        return self.page.locator('[role="dialog"]').last

    def expect_dialog(self, timeout: int = 20_000) -> None:
        expect(self.dialog()).to_be_visible(timeout=timeout)

    def expect_dialog_closed(self, timeout: int = 60_000) -> None:
        expect(self.page.locator('[role="dialog"]')).to_have_count(0, timeout=timeout)

    def select(self, ai_id: str, label: str) -> None:
        """Radix Select：点触发按钮再按文案选 option。"""
        trigger = self.locator(ai_id)
        expect(trigger).to_be_visible(timeout=20_000)
        trigger.click()
        option = self.page.get_by_role("option").filter(has_text=label).first
        expect(option).to_be_visible(timeout=20_000)
        option.click()

    def current_select_text(self, ai_id: str) -> str:
        return self.locator(ai_id).inner_text()

    def delete_via_dialog(self, trigger_ai_id: str, resource: str, name: str) -> None:
        """删除确认框要求输入完整名称；resource 是 dialog 的句柄前缀。"""
        self.click(trigger_ai_id)
        expect_dialog = self.locator(f"{resource}:delete-input")
        expect(expect_dialog).to_be_visible(timeout=20_000)
        expect_dialog.fill(name)
        confirm = self.locator(f"{resource}:delete-confirm")
        expect(confirm).to_be_enabled(timeout=20_000)
        confirm.click()

    # ---------------------------------------------------------------- api --
    def _call(self, method: str, path: str, body: dict | None = None, timeout: float = 60) -> tuple[int, dict[str, Any]]:
        assert self.api is not None, "DevopsPage 需要传入 ApiClient"
        return self.api.request(method, path, body, timeout=timeout)

    def unique(self, prefix: str) -> str:
        return f"{prefix}-{uuid4().hex[:8]}"

    def projects(self) -> list[dict[str, Any]]:
        status, body = self._call("GET", PROJECTS)
        assert status == 200, f"GET {PROJECTS} -> {status}: {str(body)[:300]}"
        return body.get("items") or []

    def project(self, name: str) -> dict[str, Any]:
        status, body = self._call("GET", f"{PROJECTS}/{name}")
        assert status == 200, f"GET {PROJECTS}/{name} -> {status}: {str(body)[:300]}"
        return body

    def namespace_of(self, item: dict[str, Any]) -> str:
        return str((item.get("status") or {}).get("adminNamespace") or (item.get("metadata") or {}).get("name") or "")

    def pick_container(self) -> tuple[str, str] | None:
        """返回一个可用于本页写用例的（工程名, 工程命名空间）；没有时返回 None。"""
        for item in self.projects():
            name = str((item.get("metadata") or {}).get("name") or "")
            namespace = self.namespace_of(item)
            if not name or not namespace:
                continue
            status, _ = self._call("GET", f"/api/v1/namespaces/{namespace}")
            if status == 200:
                return name, namespace
        return None

    def create_project(self, workspace: str = "system-workspace", alias: str | None = None, description: str | None = None) -> dict[str, Any]:
        annotations: dict[str, str] = {}
        if alias:
            annotations["kubesphere.io/alias-name"] = alias
        if description:
            annotations["kubesphere.io/description"] = description
        body: dict[str, Any] = {
            "kind": "DevOpsProject",
            "apiVersion": "devops.kubesphere.io/v1alpha3",
            "metadata": {"generateName": self.unique("pwspec-proj"), "labels": {"kubesphere.io/workspace": workspace}},
            "spec": {},
        }
        if annotations:
            body["metadata"]["annotations"] = annotations
        status, created = self._call("POST", f"{DEVOPS_KAPIS}/workspaces/{workspace}/devops", body)
        assert status == 200, f"create project -> {status}: {str(created)[:400]}"
        return created

    def delete_project(self, name: str) -> None:
        status, _ = self._call("DELETE", f"{PROJECTS}/{name}")
        assert status in (200, 202, 404), f"delete project {name} -> {status}"

    def delete_project_quiet(self, name: str) -> None:
        try:
            self._call("DELETE", f"{PROJECTS}/{name}")
        except Exception:  # noqa: BLE001 - 清理尽力而为
            pass

    def pipelines(self, project: str, **query: Any) -> tuple[list[dict[str, Any]], int]:
        params = "&".join(f"{key}={value}" for key, value in query.items())
        path = f"{DEVOPS_KAPIS}/devops/{project}/pipelines"
        if params:
            path = f"{path}?{params}"
        status, body = self._call("GET", path)
        assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
        items = body.get("items") or []
        return items, int(body.get("totalItems") if isinstance(body.get("totalItems"), int) else len(items))

    def pipeline(self, project: str, name: str) -> dict[str, Any]:
        status, body = self._call("GET", f"{DEVOPS_KAPIS}/devops/{project}/pipelines/{name}")
        assert status == 200, f"GET pipeline {name} -> {status}: {str(body)[:300]}"
        return body

    def create_pipeline(
        self,
        project: str,
        name: str,
        kind: str = "pipeline",
        jenkinsfile: str = "pipeline {\n  agent any\n}",
        alias: str | None = None,
        description: str | None = None,
        repo: str = "https://github.com/kube-ai-hub/probe.git",
        owner: str = "kube-ai-hub",
    ) -> dict[str, Any]:
        metadata: dict[str, Any] = {"name": name}
        annotations: dict[str, str] = {}
        if alias:
            annotations["kubesphere.io/alias-name"] = alias
        if description:
            annotations["kubesphere.io/description"] = description
        if annotations:
            metadata["annotations"] = annotations
        if kind == "multi-branch-pipeline":
            spec = {
                "type": "multi-branch-pipeline",
                "multi_branch_pipeline": {
                    "name": name,
                    "source_type": "github",
                    "script_path": "Jenkinsfile",
                    "github_source": {"credential_id": "", "repo": repo, "owner": owner},
                },
            }
        else:
            spec = {"type": "pipeline", "pipeline": {"name": name, "jenkinsfile": jenkinsfile}}
        status, body = self._call(
            "POST",
            f"{DEVOPS_KAPIS}/devops/{project}/pipelines",
            {"kind": "Pipeline", "apiVersion": "devops.kubesphere.io/v1alpha3", "metadata": metadata, "spec": spec},
        )
        assert status == 200, f"create pipeline {name} -> {status}: {str(body)[:400]}"
        return body

    def delete_pipeline(self, project: str, name: str) -> None:
        status, _ = self._call("DELETE", f"{DEVOPS_KAPIS}/devops/{project}/pipelines/{name}")
        assert status in (200, 202, 404), f"delete pipeline {name} -> {status}"

    def delete_pipeline_quiet(self, project: str, name: str) -> None:
        try:
            self._call("DELETE", f"{DEVOPS_KAPIS}/devops/{project}/pipelines/{name}")
        except Exception:  # noqa: BLE001
            pass

    def runs(self, namespace: str, pipeline: str | None = None) -> list[dict[str, Any]]:
        path = f"{DEVOPS}/namespaces/{namespace}/pipelineruns"
        if pipeline:
            path = f"{path}?labelSelector=devops.kubesphere.io%2Fpipeline%3D{pipeline}"
        status, body = self._call("GET", path)
        assert status == 200, f"GET runs -> {status}: {str(body)[:300]}"
        return body.get("items") or []

    def run(self, namespace: str, name: str) -> dict[str, Any]:
        status, body = self._call("GET", f"{DEVOPS}/namespaces/{namespace}/pipelineruns/{name}")
        assert status == 200, f"GET run {name} -> {status}"
        return body

    def create_run(self, namespace: str, pipeline: str, branch: str | None = None) -> dict[str, Any]:
        spec: dict[str, Any] = {
            "pipelineRef": {"name": pipeline, "kind": "Pipeline", "apiVersion": "devops.kubesphere.io/v1alpha3"},
            "parameters": [],
        }
        if branch:
            spec["scm"] = {"refName": branch, "refType": "branch"}
        body = {
            "kind": "PipelineRun",
            "apiVersion": "devops.kubesphere.io/v1alpha3",
            "metadata": {
                "generateName": f"{pipeline}-",
                "namespace": namespace,
                "labels": {"devops.kubesphere.io/pipeline": pipeline},
            },
            "spec": spec,
        }
        status, created = self._call("POST", f"{DEVOPS}/namespaces/{namespace}/pipelineruns", body)
        assert status == 201, f"create run -> {status}: {str(created)[:400]}"
        return created

    def delete_run_quiet(self, namespace: str, name: str) -> None:
        try:
            self._call("DELETE", f"{DEVOPS}/namespaces/{namespace}/pipelineruns/{name}")
        except Exception:  # noqa: BLE001
            pass

    def secrets(self, namespace: str) -> list[dict[str, Any]]:
        status, body = self._call("GET", f"/api/v1/namespaces/{namespace}/secrets")
        assert status == 200, f"GET secrets -> {status}"
        return body.get("items") or []

    def devops_credential_secrets(self, namespace: str) -> dict[str, dict[str, Any]]:
        return {
            str((item.get("metadata") or {}).get("name") or ""): item
            for item in self.secrets(namespace)
            if str(item.get("type") or "") in CREDENTIAL_SECRET_TYPES.values()
        }

    def delete_credential_quiet(self, project: str, name: str) -> None:
        try:
            self._call("DELETE", f"{DEVOPS_KAPIS}/devops/{project}/credentials/{name}")
        except Exception:  # noqa: BLE001
            pass

    def members(self, project: str) -> list[dict[str, Any]]:
        status, body = self._call("GET", f"{IAM_KAPIS}/devops/{project}/members?limit=-1")
        assert status == 200, f"GET members -> {status}"
        return body.get("items") or []

    def member_role(self, project: str, username: str) -> str | None:
        for item in self.members(project):
            if (item.get("metadata") or {}).get("name") == username:
                return str(((item.get("metadata") or {}).get("annotations") or {}).get("iam.kubesphere.io/role") or "")
        return None

    def remove_member_quiet(self, project: str, username: str) -> None:
        try:
            self._call("DELETE", f"{IAM_KAPIS}/devops/{project}/members/{username}")
        except Exception:  # noqa: BLE001
            pass

    def roles(self, project: str) -> list[dict[str, Any]]:
        status, body = self._call("GET", f"{IAM_KAPIS}/devops/{project}/roles?limit=-1")
        assert status == 200, f"GET roles -> {status}"
        return body.get("items") or []

    def code_repositories(self, namespace: str) -> list[dict[str, Any]]:
        status, body = self._call("GET", f"{DEVOPS}/namespaces/{namespace}/gitrepositories")
        assert status == 200, f"GET gitrepositories -> {status}"
        return body.get("items") or []

    def delete_code_repository_quiet(self, namespace: str, name: str) -> None:
        try:
            self._call("DELETE", f"{DEVOPS}/namespaces/{namespace}/gitrepositories/{name}")
        except Exception:  # noqa: BLE001
            pass

    # --------------------------------------------------------- assertions --
    def request_log(self) -> list[str]:
        urls: list[str] = []

        def _record(request) -> None:  # type: ignore[no-untyped-def]
            urls.append(request.url)

        self.page.on("request", _record)
        return urls

    def pipeline_list_url_matcher(self) -> re.Pattern[str]:
        return re.compile(r"/kapis/devops\.kubesphere\.io/v1alpha3/devops/[^/]+/pipelines(\?.*)?$")
