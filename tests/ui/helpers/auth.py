"""Log in through the console login page and keep the session.

The old console encrypts the password before posting it to `/oauth/token`
(`src/utils/index.js: encrypt`). Reproducing that here is what lets the tests log
in without a browser round-trip, and keeps them working when the login page
changes. `encrypt` is only meaningful for that app: the new frontend's login page
(when `KA_BASE_URL` points at it) posts the password as typed.
"""

from __future__ import annotations

import base64
from typing import Any

from helpers.config import UiConfig

LOGIN_PATH = "/login"


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def encrypt(salt: str, raw: str) -> str:
    """Mirror of the console's `mix(salt, Base64.encode(str))`."""
    encoded = _b64(raw)
    if len(encoded) > len(salt):
        salt += encoded[: len(encoded) - len(salt)]

    chars: list[str] = []
    prefix: list[str] = []
    for index, ch in enumerate(salt):
        tomix = ord(encoded[index]) if len(encoded) > index else 64
        total = ord(ch) + tomix
        prefix.append("0" if total % 2 == 0 else "1")
        chars.append(chr(total // 2))
    return f"{_b64(''.join(prefix))}@{''.join(chars)}"


def login(page: Any, config: UiConfig) -> str:
    """Log in and return the access token."""
    if not config.password:
        raise RuntimeError("KA_PASSWORD is not set (copy tests/ui/env.example to .env)")

    page.goto(config.url(LOGIN_PATH), wait_until="domcontentloaded")
    page.fill("input[name=username]", config.username)
    page.fill("input[name=password]", config.password)
    page.click("button:has-text('登录'), button:has-text('Log in'), button[type=submit]")
    page.wait_for_url(lambda url: LOGIN_PATH not in url, timeout=30_000)

    token = page.evaluate(
        """() => localStorage.getItem('kah_token') || localStorage.getItem('token')
            || localStorage.getItem('kubesphere-token') || ''"""
    )
    if not token:
        raise RuntimeError("logged in but no token in localStorage")
    return token


def api_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
