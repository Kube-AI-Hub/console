from __future__ import annotations

import pytest
from playwright.sync_api import expect

from helpers.api import ApiClient

pytestmark = pytest.mark.ui

S2I = "/apis/devops.kubesphere.io/v1alpha1"
PROJECT = "default"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_01(page, ui_config, session_token, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01 镜像构建器：只读列表与空态。"""

    api = ApiClient(ui_config.app, session_token)
    status, body = api.request("GET", f"{S2I}/namespaces/{PROJECT}/s2ibuilders")
    assert status == 200 and isinstance(body, dict), f"s2ibuilders API -> {status} {body}"
    items = body.get("items") or []

    requests: list[str] = []
    page.on("request", lambda request: requests.append(f"{request.method} {request.url}"))

    page.goto(f"{ui_config.app}/kube-frontend/system-workspace/clusters/host/projects/{PROJECT}/s2ibuilder")
    surface = page.locator('[data-ai-id="image-builder:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    state = surface.get_attribute("data-ai-state")
    if items:
        assert state == "ready", f"有 {len(items)} 个构建器但页面状态为 {state}"
        rows = surface.locator("[data-ai-row]")
        expect(rows).to_have_count(len(items), timeout=30_000)
        headers = [text.strip() for text in surface.locator("thead th:visible").all_inner_texts() if text.strip()]
        for column in ("名称", "基础镜像", "状态", "创建时间"):
            assert column in headers, f"缺少列 {column}: {headers}"
    else:
        # This cluster currently has zero builders in every namespace; the empty state is
        # the honest result and must say where builders come from rather than look broken.
        assert state == "empty", f"API 0 条但页面状态为 {state}"
        body_text = surface.inner_text()
        assert "镜像构建器" in body_text, body_text[:300]
        assert "S2I" in body_text or "B2I" in body_text, body_text[:300]
        assert page.locator('[data-ai-id="resource-error"]').count() == 0

    # No write entry, no write request, and not the v1alpha3 collection that answers 404.
    writes = [entry for entry in requests if entry.split(" ", 1)[0] in {"POST", "PUT", "PATCH", "DELETE"}]
    assert writes == [], f"页面发起了写请求: {writes}"
    wrong_version = [entry for entry in requests if "v1alpha3" in entry and "s2ibuilders" in entry]
    assert wrong_version == [], f"页面请求了错误的 API 版本: {wrong_version}"

    screenshot(page, "image-builder")
