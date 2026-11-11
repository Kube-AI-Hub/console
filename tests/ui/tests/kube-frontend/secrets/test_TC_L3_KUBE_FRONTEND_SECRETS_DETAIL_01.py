from __future__ import annotations

import re

import pytest

pytestmark = pytest.mark.ui

TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_DETAIL_01(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01 保密字典详情：属性与遮挡切换。"""

    name = e2e_objects["unique"]() + "-tls"
    e2e_objects["secret"](name, type_="kubernetes.io/tls", data={"tls.crt": "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----", "tls.key": "-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----"})
    secrets_page.open_detail(name)

    assert secrets_page.detail_state == "ready"
    assert secrets_page.attribute("cluster") == "host"
    assert secrets_page.attribute("project") == "default"
    assert secrets_page.attribute("type") == "TLS 信息"
    assert TIMESTAMP.match(secrets_page.attribute("created")), secrets_page.attribute("created")
    assert secrets_page.attribute("creator") != ""

    text = secrets_page.data_section.inner_text()
    assert "证书" in text and "私钥" in text
    assert "-----BEGIN" not in text
    assert not secrets_page.values_revealed

    secrets_page.reveal()
    revealed = secrets_page.data_section.inner_text()
    assert "-----BEGIN CERTIFICATE-----" in revealed
    assert "-----BEGIN PRIVATE KEY-----" in revealed
    screenshot(secrets_page.page, "detail-tls")
