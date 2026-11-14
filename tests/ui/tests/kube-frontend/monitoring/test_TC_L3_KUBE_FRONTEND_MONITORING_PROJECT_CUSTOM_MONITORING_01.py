from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

CLUSTERS = "/kapis/cluster.kubesphere.io/v1alpha1/clusters"
NAMESPACES = "/kapis/resources.kubesphere.io/v1alpha3/namespaces?limit=-1"
DASHBOARDS = "/apis/monitoring.kubesphere.io/v1alpha2/namespaces/{ns}/dashboards"
WORKSPACE_LABEL = "kubesphere.io/workspace"


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_MONITORING_PROJECT_CUSTOM_MONITORING_01(monitoring_page, screenshot):
    """TC-L3-KUBE-FRONTEND-MONITORING-PROJECT_CUSTOM_MONITORING-01 项目自定义监控 · 仪表板列表与空态。"""

    ui = monitoring_page
    assert ui.api is not None

    clusters = [
        (item.get("metadata") or {}).get("name")
        for item in (_read(ui, CLUSTERS).get("items") or [])
    ]
    cluster = next((name for name in clusters if name), "host")

    # A project is a namespace carrying the workspace label. Pick the first one: the page
    # itself takes only the namespace, and the URL's workspace segment should match it.
    projects = []
    for item in _read(ui, NAMESPACES).get("items") or []:
        metadata = item.get("metadata") or {}
        labels = metadata.get("labels") or {}
        if metadata.get("name") and labels.get(WORKSPACE_LABEL):
            projects.append((labels[WORKSPACE_LABEL], metadata["name"]))
    if not projects:
        pytest.skip("没有可用的项目命名空间")
    workspace, namespace = projects[0]

    dashboards = _read(ui, DASHBOARDS.format(ns=namespace)).get("items") or []
    names = [(item.get("metadata") or {}).get("name") for item in dashboards]

    url = f"{ui.base_url}/kube-frontend/{workspace}/clusters/{cluster}/projects/{namespace}/custom-monitoring"
    ui.page.goto(url)
    surface = ui.page.locator('[data-ai-id="project-custom-monitoring:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

    state = surface.get_attribute("data-ai-state")
    if not dashboards:
        assert state == "empty", f"expected empty state, got {state}"
        empty = ui.page.locator('[data-ai-id="project-custom-monitoring:empty"]').last
        expect(empty).to_be_visible(timeout=20_000)
        text = empty.inner_text()
        assert "还没有自定义监控仪表板" in text, text
        assert surface.locator("thead").count() == 0
    else:
        assert state == "ready", f"expected ready state, got {state}"
        headers = [value.strip() for value in surface.locator("thead th:visible").all_inner_texts() if value.strip()]
        for expected_header in ("名称", "面板数", "可编辑", "创建时间"):
            assert expected_header in headers, headers
        rows = surface.locator("tbody tr[data-ai-row]")
        expect(rows).to_have_count(len(dashboards), timeout=30_000)
        rendered = rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
        assert sorted(str(value) for value in rendered) == sorted(str(name) for name in names)

    screenshot(ui.page, "project-custom-monitoring")
