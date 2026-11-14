"""The API client used by fixtures and assertions, loaded without the `conftest` name.

Why this exists: the root `conftest.py` defines `ApiClient`, and importing it as
`from conftest import ApiClient` works until a nested conftest (for example
`tests/kube-frontend/user-settings/conftest.py`) is registered under the same module
name first — the import then resolves to that file, which has no `ApiClient`, and
collection fails with "cannot import name". Loading the root file by path removes the
name from the resolution entirely.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

_ROOT_CONFTEST = Path(__file__).resolve().parents[1] / "conftest.py"
_spec = importlib.util.spec_from_file_location("_root_conftest_for_api_client", _ROOT_CONFTEST)
assert _spec is not None and _spec.loader is not None
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)

ApiClient = _module.ApiClient

__all__ = ["ApiClient"]