from __future__ import annotations

from pathlib import Path

import pytest

from helpers.auth import login
from helpers.config import load_config
from pages.juicefs_storage import SharedStoragePage

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
            }} catch (e) {{}}
        }}"""
    )
    yield context
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
def screenshot(request):
    """Save a screenshot under artifacts/<test>/<name>.png."""

    def _shot(page, name: str) -> Path:
        folder = ARTIFACTS / request.node.name.replace("/", "_")
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{name}.png"
        page.screenshot(path=str(path), full_page=True)
        return path

    return _shot
