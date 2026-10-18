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

    def url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"

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
    )
