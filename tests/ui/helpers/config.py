"""Configuration from environment / .env."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

UI_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(UI_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return default if value is None else value


@dataclass
class UiConfig:
    base_url: str
    cluster: str
    username: str
    password: str
    headless: bool
    contrast_text: float
    contrast_muted: float
    #: Where the new console (kube-frontend) is served. Defaults to the bare base
    #: URL, i.e. the legacy console deployed on `KA_BASE_URL`. The kube-frontend
    #: suites run against the BFF-backed dev server (`KA_APP_URL`), because the
    #: legacy deployment has no `/kube-frontend` bundle; sign-in still goes
    #: through `KA_BASE_URL`, which is the console that owns `/oauth/token`.
    app_url: str = ""
    #: Dedicated account for the login cases. They sign out for real, which
    #: revokes the session upstream; sharing the main account would take the rest
    #: of the run down with it.
    login_username: str = ""
    login_password: str = ""

    @property
    def login_user(self) -> str:
        return self.login_username or self.username

    @property
    def login_pass(self) -> str:
        return self.login_password or self.password

    @property
    def app(self) -> str:
        """Origin the kube-frontend pages live on."""
        return self.app_url or self.base_url

    def url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"

    def app_url_for(self, path: str) -> str:
        return f"{self.app.rstrip('/')}/{path.lstrip('/')}"

    def cluster_url(self, suffix: str) -> str:
        return self.url(f"clusters/{self.cluster}/{suffix.lstrip('/')}")


def load_config() -> UiConfig:
    return UiConfig(
        base_url=_env("KA_BASE_URL", "https://console-dev.brightaitoken.ai"),
        cluster=_env("KA_CLUSTER", "default"),
        username=_env("KA_USERNAME", "admin"),
        password=_env("KA_PASSWORD", ""),
        headless=_env("KA_HEADLESS", "true").lower() in {"1", "true", "yes", "on"},
        contrast_text=float(_env("KA_CONTRAST_TEXT", "4.5")),
        contrast_muted=float(_env("KA_CONTRAST_MUTED", "3.0")),
        app_url=_env("KA_APP_URL", ""),
        login_username=_env("KA_LOGIN_USERNAME", ""),
        login_password=_env("KA_LOGIN_PASSWORD", ""),
    )
