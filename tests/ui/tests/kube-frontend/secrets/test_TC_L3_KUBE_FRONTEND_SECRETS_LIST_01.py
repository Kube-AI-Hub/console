from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_LIST_01(secrets_page, e2e_objects, screenshot):
    """TC-L3-KUBE-FRONTEND-SECRETS-LIST-01 保密字典列表：列与类型显示。"""

    tls = e2e_objects["secret"](e2e_objects["unique"]() + "-tls", type_="kubernetes.io/tls", data={"tls.crt": "c", "tls.key": "k"})
    secrets_page.open()
    assert secrets_page.state == "ready", secrets_page.state

    headers = secrets_page.headers
    assert headers[:5] == ["名称", "项目", "类型", "字段数", "创建时间"], headers
    row = secrets_page.row_text(tls)
    assert "TLS 信息" in row, row
    assert "2" in row, row
    screenshot(secrets_page.page, "list")
