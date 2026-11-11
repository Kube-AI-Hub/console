from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_SECRETS_01(secrets_page, e2e_objects, screenshot):
    """TC-FULL-KUBE_FRONTEND-SECRETS-01 保密字典：四种类型的详情按各自结构展示，且默认遮挡。"""

    # The four payloads kube-apiserver accepts, one object each.
    cases = {
        "opaque": e2e_objects["secret"](
            e2e_objects["unique"]() + "-opaque", data={"username": "u-secret-value", "password": "p-secret-value"}
        ),
        "tls": e2e_objects["secret"](
            e2e_objects["unique"]() + "-tls",
            type_="kubernetes.io/tls",
            data={"tls.crt": "CERT-SECRET-VALUE", "tls.key": "KEY-SECRET-VALUE"},
        ),
        "docker": e2e_objects["secret"](
            e2e_objects["unique"]() + "-docker",
            type_="kubernetes.io/dockerconfigjson",
            data={".dockerconfigjson": '{"auths":{"https://r.example.com":{"username":"robot","password":"REG-SECRET-VALUE"}}}'},
        ),
        "basic": e2e_objects["secret"](
            e2e_objects["unique"]() + "-basic",
            type_="kubernetes.io/basic-auth",
            data={"username": "BASIC-USER-VALUE", "password": "BASIC-PASS-VALUE"},
        ),
    }

    for kind, name in cases.items():
        secrets_page.open_detail(name)
        assert secrets_page.detail_state == "ready"
        secret_values = ["u-secret-value", "p-secret-value", "CERT-SECRET-VALUE", "KEY-SECRET-VALUE", "REG-SECRET-VALUE", "BASIC-USER-VALUE", "BASIC-PASS-VALUE"]

        # Nothing is in the clear until the eye is pressed.
        text = secrets_page.data_section.inner_text()
        for value in secret_values:
            assert value not in text, f"{kind}: {value} shown before reveal"
        assert "*" in text

        # Structure per type.
        if kind == "tls":
            assert "证书" in text and "私钥" in text
        if kind == "basic":
            assert "用户名" in text and "密码" in text
        if kind == "docker":
            assert "https://r.example.com" in text

        secrets_page.reveal()
        revealed = secrets_page.data_section.inner_text()
        expected = {
            "opaque": ["u-secret-value"],
            "tls": ["CERT-SECRET-VALUE", "KEY-SECRET-VALUE"],
            "docker": ["REG-SECRET-VALUE"],
            "basic": ["BASIC-USER-VALUE", "BASIC-PASS-VALUE"],
        }[kind]
        for value in expected:
            assert value in revealed, f"{kind}: {value} missing after reveal"
        screenshot(secrets_page.page, f"detail-{kind}-revealed")
