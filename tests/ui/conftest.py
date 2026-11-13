from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest

from helpers.auth import login
from helpers.config import load_config
from pages.gpu_cards import GpuCardsPage
from pages.juicefs_storage import SharedStoragePage
from pages.resource_detail import ResourceDetailPage
from pages.login import LoginPage
from pages.configmaps import ConfigMapsPage
from pages.cluster_configmaps import ClusterConfigMapsPage
from pages.secrets import SecretsPage
from pages.serviceaccounts import ServiceAccountsPage
from pages.access_control import AccessControlPage
from pages.cluster_management import ClusterManagementPage
from pages.cluster_overview import ClusterOverviewPage
from pages.cluster_monitor import ClusterMonitorPage
from pages.cluster_settings import ClusterSettingsPage
from pages.monitoring import MonitoringPage
from pages.platform_settings import PlatformSettingsPage
from pages.project_settings import ProjectSettingsPage
from pages.storage import StoragePage
from pages.app_workloads import AppWorkloadsPage

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"

# Shared clusters answer slowly under load (a pod list on the A100 environment took
# 17s against the same API that answered a deployment list in 3s). Playwright's 5s
# default then reports "still loading" or "dialog still open" for a request that is
# merely in flight — a red suite that says nothing about the product. Raised once,
# here, instead of sprinkling `timeout=` through every assertion.
from playwright.sync_api import expect as _expect  # noqa: E402

_expect.set_options(timeout=20_000)





def app_base(ui_config) -> str:
    """Base URL for the kube-frontend pages (see `UiConfig.app`)."""
    return ui_config.app.rstrip("/")


def _storage_state(origin: str, token: str) -> dict:
    """LocalStorage for one origin, as Playwright's `storage_state` expects.

    All three keys the two consoles use are written, so a page never has to care
    which one its own build reads.
    """
    value = [
        {"name": "kubesphere-token", "value": token},
        {"name": "kah_token", "value": token},
        {"name": "token", "value": token},
    ]
    return {"cookies": [], "origins": [{"origin": origin.rstrip("/"), "localStorage": value}]}


def _app_token(ui_config) -> str:
    """A bearer token minted by the console serving `UiConfig.app`.

    Minted through the BFF's own login endpoint rather than by driving the legacy
    login form: that form encrypts the password with the console's
    `mix(salt, base64(pw))` before posting, and the dev deployment rejects the
    plaintext the helper sends. The BFF takes the password as typed and returns
    the same token type the UI stores.
    """
    import json
    import urllib.request

    request = urllib.request.Request(
        f"{app_base(ui_config)}/api/session/login",
        data=json.dumps({"username": ui_config.username, "password": ui_config.password}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            session = json.loads(response.read().decode("utf-8"))
    except Exception as error:  # noqa: BLE001 - re-raised with context for the report
        raise RuntimeError(f"could not sign in through {app_base(ui_config)}/api/session/login: {error}") from error
    token = str(session.get("token") or "")
    if not token:
        raise RuntimeError(f"login through {app_base(ui_config)} returned no token")
    return token


def _b64(text: str) -> str:
    import base64

    return base64.b64encode(text.encode("utf-8")).decode("ascii")


class ApiClient:
    """Minimal JSON client over `urllib`, for fixture setup and assertions.

    Uses `urllib` rather than Playwright's API context: that context was observed
    hanging on PUT/POST against a real deployment while the same request through
    `curl` answered in under half a second.
    """

    def __init__(self, base: str, token: str) -> None:
        self.base = base
        self.token = token

    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        content_type: str = "application/json",
        timeout: float = 30,
    ) -> tuple[int, dict]:
        """One API call.

        `timeout` is a parameter because this cluster's list endpoints scale with object
        count rather than payload size: listing the pods of a large project takes ~60s,
        which is longer than the default a normal call should wait. Pass a larger value
        for those, and keep the default tight so a hung server still fails fast.
        """
        import json
        import urllib.error
        import urllib.request

        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            f"{self.base}{path}",
            data=data,
            method=method,
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": content_type, "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                text = response.read().decode("utf-8")
                return response.status, (json.loads(text) if text else {})
        except urllib.error.HTTPError as error:
            text = error.read().decode("utf-8")
            try:
                parsed = json.loads(text) if text else {}
            except ValueError:
                parsed = {"raw": text[:300]}
            return error.code, parsed

    def get(self, kind: str, name: str, namespace: str = "default") -> dict:
        status, body = self.request("GET", f"/api/v1/namespaces/{namespace}/{kind}/{name}")
        return {"__status": status, **body}

    def get_kapis(self, kind: str, name: str, namespace: str = "default") -> dict:
        """Read a resource the way the pages do.

        Writes go to `/api/v1`, but the console reads through ks-apiserver's kapis
        endpoint, which is a *different* path and can lag the write by a moment. A
        test that waits only on `/api/v1` is waiting on the wrong source: the page
        can still render the stale object underneath it.
        """
        status, body = self.request("GET", f"/kapis/resources.kubesphere.io/v1alpha3/namespaces/{namespace}/{kind}/{name}")
        return {"__status": status, **body}

    def delete(self, kind: str, name: str, namespace: str = "default") -> int:
        status, _ = self.request("DELETE", f"/api/v1/namespaces/{namespace}/{kind}/{name}")
        return status

    def patch(self, kind: str, name: str, body: dict, namespace: str = "default") -> int:
        status, _ = self.request("PATCH", f"/api/v1/namespaces/{namespace}/{kind}/{name}", body, "application/merge-patch+json")
        return status

    def create(self, kind: str, body: dict, namespace: str = "default") -> int:
        status, _ = self.request("POST", f"/api/v1/namespaces/{namespace}/{kind}", body)
        return status




def pytest_configure(config):
    for marker in ("ui", "core", "full", "point", "flow", "bug"):
        config.addinivalue_line("markers", f"{marker}: see tests/README.md")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)


@pytest.fixture(scope="session")
def ui_config():
    return load_config()


@pytest.fixture(scope="session")
def browser_type_launch_args(ui_config):
    return {"headless": ui_config.headless}


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, ui_config):
    return {
        **browser_context_args,
        "viewport": {"width": 1600, "height": 900},
        "locale": "zh-CN",
        "ignore_https_errors": True,
    }


@pytest.fixture(scope="session")
def session_token(ui_config) -> str:
    """A bearer token for the console the kube-frontend pages are served by."""
    return _app_token(ui_config)


@pytest.fixture(scope="session")
def logged_in_context(browser, ui_config, session_token):
    """A browser context holding a session on the kube-frontend origin.

    `storage_state` seeds localStorage for that exact origin, so pages open signed
    in without replaying a login form — and the legacy console's login flow (which
    these suites do not exercise) stays out of the setup path.
    """
    context = browser.new_context(
        viewport={"width": 1600, "height": 900},
        locale="zh-CN",
        ignore_https_errors=True,
        storage_state=_storage_state(app_base(ui_config), session_token),
    )
    yield context
    context.close()


@pytest.fixture
def anonymous_page(browser, ui_config):
    """A context with no token.

    The default `page` is already signed in, which is right for every resource
    test and wrong for the login tests: they need to watch a session start and
    end, and a pre-seeded token hides exactly the behaviour under test.
    """
    context = browser.new_context(
        viewport={"width": 1600, "height": 900},
        locale="zh-CN",
        ignore_https_errors=True,
    )
    page = context.new_page()
    yield page
    context.close()


@pytest.fixture
def page(logged_in_context):
    page = logged_in_context.new_page()
    yield page
    page.close()


@pytest.fixture
def storage_page(page, ui_config):
    return SharedStoragePage(page, ui_config)


@pytest.fixture
def gpu_page(page, ui_config):
    return GpuCardsPage(page, ui_config)


@pytest.fixture
def detail_page(page, ui_config):
    return ResourceDetailPage(page, ui_config)


@pytest.fixture
def configmaps_page(page, ui_config):
    # The kube-frontend pages live on `UiConfig.app`, not `base_url`: `KA_BASE_URL`
    # is the legacy console that owns the session, and it has no `/kube-frontend`
    # bundle. The page object was the last one still pointed at it.
    return ConfigMapsPage(page, app_base(ui_config))


@pytest.fixture
def cluster_configmaps_page(page, ui_config):
    """The cluster console's ConfigMap list; same app, no workspace segment."""
    return ClusterConfigMapsPage(page, app_base(ui_config))


@pytest.fixture
def seeded_configmaps(ui_config, session_token):
    """A project holding a known pair of ConfigMaps, deleted afterwards.

    Several list/detail/edit cases assert against specific objects; without this
    they only pass on a cluster that happens to contain them, and the failure
    reads as a page bug. Names are prefixed so a crashed run leaves obvious trash
    rather than something that looks like real data.

    Uses the same `ApiClient` as the other fixtures: Playwright's API context
    hung on POST against this deployment while `urllib` answered in well under a
    second, and a fixture that hangs fails the test with no product signal.
    """
    namespace = "default"
    api = ApiClient(app_base(ui_config), session_token)
    created: list[str] = []
    # Unique per fixture instance, i.e. per worker/test.
    #
    # These names used to be fixed (`case-a`, `case-b`) and seven cases create them;
    # run the suite in parallel and one worker's teardown deletes the object another is
    # still asserting on, which reads as a product bug. Callers read the real names back
    # from the page, so the prefix is invisible to them.
    token = f"pw{uuid4().hex[:6]}"

    def create(
        name: str,
        data: dict[str, str],
        annotations: dict[str, str] | None = None,
        target_namespace: str | None = None,
    ) -> str:
        """Create one object; `target_namespace` defaults to the fixture's own.

        Cluster-level cases need the same name in two projects, so the namespace is
        a parameter rather than a closure constant.
        """
        ns = target_namespace or namespace
        name = f"{token}-{name}"
        body = {
            "apiVersion": "v1",
            "kind": "ConfigMap",
            # `annotations` goes where Kubernetes reads it. It used to be merged straight
            # into `metadata`, so every caller that passed `{"kubesphere.io/alias-name":
            # ...}` wrote a metadata field the API ignores and the console never showed.
            "metadata": {"name": name, "namespace": ns, **({"annotations": annotations} if annotations else {})},
            "data": data,
        }
        status = api.create("configmaps", body, ns)
        if status not in (200, 201):
            # Raising rather than returning quietly: a caller that believed it had two
            # objects then asserted against one, and the case failed later at a point
            # that pointed at the page instead of at the fixture.
            raise AssertionError(f"could not create configmap {ns}/{name}: {status}")
        created.append((ns, name))
        return name

    try:
        yield {"namespace": namespace, "create": create}
    finally:
        # Unconditional: a failed assertion must not leave objects behind for the
        # next run to trip over — that is how earlier leftovers were misread as
        # product bugs.
        for ns, name in created:
            api.delete("configmaps", name, ns)


@pytest.fixture
def cluster_configmaps_edit_fixture(seeded_configmaps, session_token, ui_config):
    """The same ConfigMap name in two projects.

    Edit and delete are addressed by `(project, name)`, and the failure they guard
    against only shows up when the name also exists elsewhere: a write that
    ignores the project either 404s or hits the wrong object. Two projects are
    enough to tell those apart.

    Three things this fixture must not assume:

    1. **The created name is the name passed in.** `seeded_configmaps` prefixes every
       object per instance so parallel workers cannot delete each other's objects, so
       the real name is the one it returns; reusing the argument string looked for an
       object that never existed.
    2. **Which projects exist.** `kube-frontend-demo` was hard-coded and is absent from
       this deployment, so the second object silently failed to create and the case then
       asserted against one object instead of two.
    3. **That create succeeds.** The old code ignored its result; a failure now raises.
    """
    api = ApiClient(app_base(ui_config), session_token)
    name = f"tc-cluster-{uuid4().hex[:8]}"
    created: dict[str, str] = {}

    # The second project has to be a *project*, and one that exists here. Walking the
    # namespaces is not enough: `kube-federation-system` is a namespace too, and a
    # ConfigMap created there is propagation state rather than a second copy a user
    # could edit. Projects are the namespaces KubeSphere labels with their workspace.
    status, body = api.request("GET", "/kapis/resources.kubesphere.io/v1alpha3/namespaces?limit=-1")
    items = (body.get("items") or []) if status == 200 and isinstance(body, dict) else []
    projects = [
        str(item.get("metadata", {}).get("name"))
        for item in items
        if isinstance(item, dict)
        and "kubesphere.io/workspace" in ((item.get("metadata", {}) or {}).get("labels") or {})
    ]
    second = next((ns for ns in projects if ns != "default"), None)
    if second is None:
        pytest.skip("集群只有一个项目，无法验证跨项目同名对象")

    for namespace in ("default", second):
        real = seeded_configmaps["create"](name, {"k": "v1"}, None, namespace)
        if not real:
            raise AssertionError(f"could not create the fixture object in {namespace}")
        created[namespace] = str(real)

    # Both projects hold the same name; tests assert that only the targeted one changed.
    return ("default", created["default"], second)


@pytest.fixture
def e2e_objects(ui_config, session_token):
    """Factory for test objects, deleted unconditionally afterwards.

    Names carry the `tc-e2e-` prefix so a crashed run leaves obvious trash rather
    than something that looks like real data. Everything is deleted in a
    `finally`: a failed assertion must not leave objects that make the next run
    fail differently.
    """
    api = ApiClient(app_base(ui_config), session_token)
    created: list[tuple[str, str, str]] = []  # (kind, namespace, name)

    def _post(kind: str, namespace: str, body: dict[str, object]) -> None:
        status = api.create(kind, body, namespace)
        if status not in (200, 201, 409):
            raise AssertionError(f"could not create {kind}/{body.get('metadata')}: {status}")
        created.append((kind, namespace, str((body.get("metadata") or {}).get("name"))))  # type: ignore[union-attr]

    def secret(
        name: str,
        *,
        type_: str = "Opaque",
        data: dict[str, str] | None = None,
        annotations: dict[str, str] | None = None,
        namespace: str = "default",
    ) -> str:
        """Create a Secret whose `data` values are given as plaintext."""
        _post(
            "secrets",
            namespace,
            {
                "apiVersion": "v1",
                "kind": "Secret",
                "metadata": {"name": name, "namespace": namespace, "annotations": annotations or {}},
                "type": type_,
                "data": {key: _b64(value) for key, value in (data or {}).items()},
            },
        )
        return name

    def service_account(
        name: str,
        *,
        role: str | None = None,
        description: str | None = None,
        secrets: list[str] | None = None,
        namespace: str = "default",
    ) -> str:
        annotations: dict[str, str] = {}
        if role:
            annotations["iam.kubesphere.io/role"] = role
        if description:
            annotations["kubesphere.io/description"] = description
        body: dict[str, object] = {
            "apiVersion": "v1",
            "kind": "ServiceAccount",
            "metadata": {"name": name, "namespace": namespace, "annotations": annotations},
        }
        if secrets:
            body["secrets"] = [{"name": item} for item in secrets]
        _post("serviceaccounts", namespace, body)
        return name

    def account_token(name: str, service_account: str, *, namespace: str = "default") -> str:
        """Create a token Secret the way the cluster's controller does.

        `kubernetes.io/service-account-token` Secrets must name their account in
        `kubernetes.io/service-account.name` (kube-apiserver answers 422
        otherwise), and the api-server fills in `token`/`ca.crt` afterwards — so
        this creates the Secret empty and reads the populated data back in
        `token_data`.
        """
        return secret(
            name,
            type_="kubernetes.io/service-account-token",
            data={},
            annotations={"kubernetes.io/service-account.name": service_account},
        )

    def token_data(name: str, namespace: str = "default") -> dict[str, str]:
        """Wait for the controller to fill a token Secret, then return its data.

        Requires a complete JWT, not just a non-empty `token`: the api-server can
        echo back a partially populated object for a moment after creation, and a
        token that is still being written is not what the page will render.
        """
        import base64
        import time

        deadline = time.time() + 30
        last: dict[str, str] = {}
        while time.time() < deadline:
            body = api.get("secrets", name, namespace)
            data = body.get("data") or {}
            token = data.get("token") or ""
            try:
                decoded = base64.b64decode(token).decode("utf-8")
            except Exception:  # noqa: BLE001 - undecodable is simply "not ready"
                decoded = ""
            if decoded.count(".") == 2 and data.get("ca.crt"):
                # Stable across two reads *and* visible through kapis: the controller
                # has finished writing, and the endpoint the page reads has caught up.
                # `/api/v1` alone is not enough — it is the write path, while the page
                # reads kapis, which can still serve the pre-token object.
                time.sleep(0.3)
                again = (api.get("secrets", name, namespace).get("data") or {}).get("token")
                via_kapis = (api.get_kapis("secrets", name, namespace).get("data") or {}).get("token")
                if again == token and via_kapis == token:
                    return data
            last = data
            time.sleep(0.25)
        raise AssertionError(f"token Secret {name} was not populated with a token/ca.crt (last keys: {list(last)})")

    def unique(prefix: str = "tc-e2e") -> str:
        import time

        return f"{prefix}-{int(time.time() * 1000) % 1_000_000}"

    try:
        yield {
            "secret": secret,
            "service_account": service_account,
            "unique": unique,
            "account_token": account_token,
            "token_data": token_data,
            "get": api.get,
            "patch": api.patch,
            "api": api,
            "base": app_base(ui_config),
        }
    finally:
        for kind, namespace, name in reversed(created):
            api.delete(kind, name, namespace)


@pytest.fixture
def secrets_page(page, ui_config):
    return SecretsPage(page, app_base(ui_config))


@pytest.fixture
def serviceaccounts_page(page, ui_config):
    return ServiceAccountsPage(page, app_base(ui_config))


@pytest.fixture
def platform_settings_page(page, ui_config, session_token):
    """平台设置（平台信息、通知渠道）。平台作用域，无集群与项目段。"""
    return PlatformSettingsPage(page, app_base(ui_config), api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def access_control_page(page, ui_config, session_token):
    """访问控制（用户、平台角色、企业空间）。平台作用域：地址里没有集群与项目段。"""
    return AccessControlPage(page, app_base(ui_config), api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def cluster_management_page(page, ui_config, session_token):
    """集群管理（节点、项目）。集群作用域：地址里没有 workspace 与项目段。"""
    return ClusterManagementPage(page, app_base(ui_config), api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def cluster_overview_page(page, ui_config, session_token):
    """集群概览。同样是集群作用域，但读两份互不依赖的数据（集群对象 + 监控）。"""
    return ClusterOverviewPage(page, app_base(ui_config), ui_config.cluster, api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def cluster_settings_page(page, ui_config, session_token):
    """集群设置。只写描述注解，用例必须在 finally 里还原原值。"""
    return ClusterSettingsPage(page, app_base(ui_config), ui_config.cluster, api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def cluster_monitor_page(page, ui_config, session_token):
    """集群监控。只读趋势页，读 range query。"""
    return ClusterMonitorPage(page, app_base(ui_config), ui_config.cluster, api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def project_settings_page(page, ui_config, session_token):
    """项目设置（项目角色、项目成员）。

    带 `ApiClient`：用例要先用 IAM 接口确认数据存在（角色、规则、成员），否则
    「列与注解一致」这类断言可能在空数据上变成假通过。
    """
    return ProjectSettingsPage(page, app_base(ui_config), api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def monitoring_page(page, ui_config, session_token):
    """监控告警列表（告警消息、告警策略）。

    与其它页面对象一样带 `ApiClient`：用例需要先用 API 确认该页确实没有数据，
    否则「空态」断言可能在有数据的集群上悄悄变成假通过。
    """
    return MonitoringPage(page, app_base(ui_config), api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def storage_page(page, ui_config, session_token):
    """存储卷与存储卷快照的列表/详情。

    与 `app_workloads_page` 同样拿到 `ApiClient`：存储卷的前置数据走核心组
    `/api/v1`，页面读 kapis；两者共用一个会话令牌。
    """
    return StoragePage(page, app_base(ui_config), api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def app_workloads_page(page, ui_config, session_token):
    """应用负载列表与详情。

    页面对象同时拿到一个 `ApiClient`：Deployment / Pod 的前置数据必须走原生 kube
    endpoint（kapis 的 resources 端点只注册了 GET），而页面读的是 kapis。两者共用
    同一个会话令牌，避免在用例里重新登录或复制 URL 拼装逻辑。
    """
    return AppWorkloadsPage(page, app_base(ui_config), api=ApiClient(app_base(ui_config), session_token))


@pytest.fixture
def login_page(anonymous_page, ui_config):
    """The migrated login page.

    Uses `app`, not `base_url`: `base_url` is the **old** console, whose login form
    has different markup. Pointing here means the login specs exercise the page this
    project ships, which is the only thing they can regress.
    """
    return LoginPage(anonymous_page, app_base(ui_config))


@pytest.fixture
def screenshot(request):
    """Save a screenshot under artifacts/<test>/<name>.png."""

    def _shot(page, name: str) -> Path:
        folder = ARTIFACTS / request.node.name.replace("/", "_")
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{name}.png"
        page.screenshot(path=str(path), full_page=True)
        return path

    return _shot
