from __future__ import annotations

from pathlib import Path

import pytest

from helpers.auth import login
from helpers.config import load_config
from pages.gpu_cards import GpuCardsPage
from pages.juicefs_storage import SharedStoragePage
from pages.resource_detail import ResourceDetailPage
from pages.login import LoginPage
from pages.configmaps import ConfigMapsPage

ARTIFACTS = Path(__file__).resolve().parent / "artifacts"


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
def logged_in_context(browser, ui_config):
    context = browser.new_context(
        viewport={"width": 1600, "height": 900},
        locale="zh-CN",
        ignore_https_errors=True,
    )
    page = context.new_page()
    token = login(page, ui_config)
    page.close()
    context.add_init_script(
        f"""() => {{
            try {{
              localStorage.setItem('token', {token!r});
              localStorage.setItem('kah_token', {token!r});
              // The new console keeps its session under this key; without it a
              // reload lands on /login even though the other two are present.
              localStorage.setItem('kubesphere-token', {token!r});
            }} catch (e) {{}}
        }}"""
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
    return ConfigMapsPage(page, ui_config.base_url)


@pytest.fixture
def seeded_configmaps(page, ui_config):
    """A project holding a known pair of ConfigMaps, deleted afterwards.

    Several list/detail/edit cases assert against specific objects; without this
    they only pass on a cluster that happens to contain them, and the failure
    reads as a page bug. Names are prefixed so a crashed run leaves obvious trash
    rather than something that looks like real data.
    """
    namespace = "default"
    # A blank page has no origin, and reading localStorage there throws. Land on
    # the app first; the token is injected into this context by `logged_in_context`.
    page.goto(ui_config.base_url, wait_until="domcontentloaded")
    token = page.evaluate(
        "() => localStorage.getItem('kah_token') || localStorage.getItem('token')"
        " || localStorage.getItem('kubesphere-token') || ''"
    )
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    base = f"{ui_config.base_url}/api/v1/namespaces/{namespace}/configmaps"

    created: list[str] = []

    def create(name: str, data: dict[str, str], annotations: dict[str, str] | None = None) -> str:
        body = {
            "apiVersion": "v1",
            "kind": "ConfigMap",
            "metadata": {"name": name, "namespace": namespace, **(annotations or {})},
            "data": data,
        }
        response = page.request.post(base, headers=headers, data=body)
        if response.status in (200, 201):
            created.append(name)
        return name

    try:
        yield {"namespace": namespace, "create": create}
    finally:
        # Unconditional: a failed assertion must not leave objects behind for the
        # next run to trip over — that is how earlier leftovers were misread as
        # product bugs.
        for name in created:
            page.request.delete(f"{base}/{name}", headers=headers)


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
