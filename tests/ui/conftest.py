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

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"




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

    def request(self, method: str, path: str, body: dict | None = None, content_type: str = "application/json") -> tuple[int, dict]:
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
            with urllib.request.urlopen(request, timeout=30) as response:
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
        body = {
            "apiVersion": "v1",
            "kind": "ConfigMap",
            "metadata": {"name": name, "namespace": ns, **(annotations or {})},
            "data": data,
        }
        if api.create("configmaps", body, ns) in (200, 201):
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
def cluster_configmaps_edit_fixture(seeded_configmaps):
    """The same ConfigMap name in two projects.

    Edit and delete are addressed by `(project, name)`, and the failure they guard
    against only shows up when the name also exists elsewhere: a write that
    ignores the project either 404s or hits the wrong object. Two projects are
    enough to tell those apart.
    """
    first = seeded_configmaps
    names = {
        "default": f"tc-cluster-{uuid4().hex[:8]}",
        "kube-frontend-demo": f"tc-cluster-{uuid4().hex[:8]}",
    }
    for namespace, name in names.items():
        first["create"](name, {"k": "v1"}, None, namespace)

    name = next(iter(names.values()))
    # The fixture exposes the name under each project; tests assert that only the
    # targeted one changed.
    return ("default", names["default"], "kube-frontend-demo")


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
                # Stable across two reads: the controller has finished writing.
                time.sleep(0.3)
                again = (api.get("secrets", name, namespace).get("data") or {}).get("token")
                if again == token:
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
def login_page(anonymous_page, ui_config):
    return LoginPage(anonymous_page, ui_config.base_url)


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
