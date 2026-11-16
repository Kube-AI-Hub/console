"""同源集成：前缀挂载、静态分流与登录态互通。

这些用例只依赖 HTTP 与浏览器存储，不依赖具体页面内容：它们验证的是「两个 UI 在
同一个地址上不互相踩」这件事，所以即便某个资源页还没迁移完也应当通过。
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


def _origin(ui_config) -> str:
    return ui_config.app.rstrip("/")


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_INTEGRATION_01(ui_config, page, screenshot):
    """TC-FULL-KUBE-FRONTEND-INTEGRATION-01 四个入口路径各自归位。"""

    origin = _origin(ui_config)
    # 裸路径属于老控制台，前缀属于新前端；两者都必须返回 HTML。
    for path in ("/", "/login", "/kube-frontend/", "/kube-frontend/login"):
        response = page.request.get(origin + path)
        assert response.status == 200, (path, response.status)
        assert "text/html" in (response.headers.get("content-type") or ""), path

    # 新前端的壳引用的是带前缀的资源，且资源真的取得到。
    shell = page.request.get(origin + "/kube-frontend/")
    html = shell.text()
    assert "/kube-frontend/assets/" in html, html[:200]

    screenshot(page, "integration-paths")
