from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SYSTEM_NAMESPACE = "kubesphere-system"
TAB_KEYS = ("resources", "monitor", "env", "logs")
TAB_LABELS = ("资源状态", "监控", "环境变量", "日志")


def _pods(ui, namespace: str) -> list[dict]:
    status, body = ui._request("GET", f"/api/v1/namespaces/{namespace}/pods?limit=200")
    assert status == 200 and isinstance(body, dict), f"读取 {namespace} 容器组失败：HTTP {status} — {repr(body)[:200]}"
    return list(body.get("items") or [])


def _pod_with_container(ui) -> tuple[str, str, str]:
    """(namespace, pod, container): a scheduled pod is preferred — its tabs have data."""
    for namespace in ("default", SYSTEM_NAMESPACE):
        for item in _pods(ui, namespace):
            containers = (item.get("spec") or {}).get("containers") or []
            name = str((item.get("metadata") or {}).get("name") or "")
            if containers and name:
                return namespace, name, str(containers[0].get("name"))
    raise AssertionError("集群里没有带容器的容器组，无法打开容器详情")


def _container_url(ui, namespace: str, pod: str, container: str) -> str:
    origin = ui.base.split("/kube-frontend/")[0]
    return f"{origin}/kube-frontend/{ui.workspace}/clusters/{ui.cluster}/projects/{namespace}/pods/{pod}/containers/{container}"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_04(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-04 容器详情：四页签与切换不重新取数。"""

    ui = app_workloads_page
    assert ui.api is not None

    namespace, pod, container = _pod_with_container(ui)
    ui.page.goto(_container_url(ui, namespace, pod, container))
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

    # Count reads of the pod object: switching tabs must not refetch it.
    detail_reads: list[str] = []
    ui.page.on(
        "request",
        lambda request: detail_reads.append(request.url)
        if request.method == "GET" and request.url.split("?")[0].endswith(f"/pods/{pod}")
        else None,
    )

    triggers = [ui.page.locator(f'[data-ai-id="container-detail:tab-trigger:{key}"]') for key in TAB_KEYS]
    for trigger in triggers:
        expect(trigger).to_be_visible(timeout=20_000)
    labels = [trigger.inner_text().strip() for trigger in triggers]
    assert labels == list(TAB_LABELS), f"页签应为 {TAB_LABELS}，实际 {labels}"
    expect(triggers[0]).to_have_attribute("aria-selected", "true")
    expect(ui.page.locator('[data-ai-id="container-detail:tab:resources"]')).to_be_visible()
    # Only the selected panel is mounted: the others are not in the DOM yet.
    assert ui.page.locator('[data-ai-id="container-detail:tab:env"]').count() == 0
    assert ui.page.locator('[data-ai-id="container-detail:tab:logs"]').count() == 0

    # ---- 监控 ----
    triggers[1].click()
    expect(ui.page.locator('[data-ai-id="container-detail:tab:monitor"]')).to_be_visible(timeout=20_000)
    expect(triggers[1]).to_have_attribute("aria-selected", "true")
    expect(triggers[0]).to_have_attribute("aria-selected", "false")

    # ---- 环境变量 ----
    triggers[2].click()
    expect(ui.page.locator('[data-ai-id="container-detail:tab:env"]')).to_be_visible(timeout=20_000)
    expect(ui.page.locator('[data-ai-id="container-detail:env"]')).to_be_visible()

    # ---- 日志 ----
    triggers[3].click()
    expect(ui.page.locator('[data-ai-id="container-detail:tab:logs"]')).to_be_visible(timeout=20_000)
    expect(ui.page.locator('[data-ai-id="container-detail:logs"]')).to_be_visible()

    # ---- back to 资源状态, still no second read of the pod object ----
    triggers[0].click()
    expect(ui.page.locator('[data-ai-id="container-detail:tab:resources"]')).to_be_visible(timeout=20_000)
    assert detail_reads == [], f"切换页签重新请求了容器组对象：{detail_reads}"

    screenshot(ui.page, "container-detail-tabs")
